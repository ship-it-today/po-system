-- ============================================================
-- Purchase Order System — database schema
-- Run this once in Supabase: SQL Editor → New query → paste → Run
-- ============================================================

-- ---------- Enums ----------
create type public.user_role as enum ('requester', 'approver', 'admin');
create type public.po_status as enum ('pending', 'approved', 'denied');

-- ---------- Profiles (one per auth user) ----------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.user_role not null default 'requester',
  disabled    boolean not null default false,   -- access removed by an admin
  created_at  timestamptz not null default now()
);

-- Auto-create a profile whenever a user signs up / is invited.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Helpers used by RLS policies.
create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select public.my_role() = 'admin'; $$;

create or replace function public.is_approver()
returns boolean language sql stable security definer set search_path = public
as $$ select public.my_role() in ('approver', 'admin'); $$;

-- ---------- Purchase orders ----------
create sequence public.po_number_seq start 1000;

create table public.purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  po_number       integer not null unique default nextval('public.po_number_seq'),
  requester_id    uuid not null references public.profiles(id),
  status          public.po_status not null default 'pending',

  -- 1–3
  department      text not null,
  project_name    text,
  payment_timing  text not null default 'next_run'
                  check (payment_timing in ('next_run', 'asap', 'by_date')),
  needed_by       date,

  -- 4–6  Pay To / vendor
  pay_to          text not null,
  vendor_street   text,
  vendor_city     text,
  vendor_state    text,
  vendor_zip      text,
  vendor_phone    text,

  -- 7–8
  payment_method  text not null
                  check (payment_method in ('check_request', 'credit_card', 'on_account')),
  delivery        text
                  check (delivery in ('mail', 'mailbox')),   -- how to hand over the check/card
  purpose         text,

  -- 9–10  Amounts. items_total is maintained by trigger from po_line_items.
  not_to_exceed   numeric(12,2),
  items_total     numeric(12,2) not null default 0,
  other_charges   numeric(12,2) not null default 0,
  total           numeric(12,2) generated always as (items_total + other_charges) stored,

  -- 11–12
  notes           text,
  receipt_status  text not null default 'will_turn_in'
                  check (receipt_status in ('uploaded', 'will_turn_in')),
  receipt_path    text,           -- object path in the "receipts" storage bucket

  -- Any extra fields added later in src/lib/po-fields.ts land here.
  custom_fields   jsonb not null default '{}'::jsonb,

  -- Approval
  approver_id     uuid references public.profiles(id),
  approver_notes  text,
  decided_at      timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index purchase_orders_requester_idx on public.purchase_orders (requester_id, created_at desc);
create index purchase_orders_status_idx on public.purchase_orders (status, created_at desc);

-- Itemized purchase details
create table public.po_line_items (
  id           uuid primary key default gen_random_uuid(),
  po_id        uuid not null references public.purchase_orders(id) on delete cascade,
  description  text not null,
  amount       numeric(12,2) not null check (amount >= 0),
  position     integer not null default 0
);

create index po_line_items_po_idx on public.po_line_items (po_id, position);

-- Keep updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger purchase_orders_touch
  before update on public.purchase_orders
  for each row execute procedure public.touch_updated_at();

-- Keep items_total in sync with line items.
create or replace function public.recalc_po_total()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target uuid := coalesce(new.po_id, old.po_id);
begin
  update public.purchase_orders
     set items_total = coalesce((select sum(amount) from public.po_line_items where po_id = target), 0)
   where id = target;
  return null;
end;
$$;

create trigger po_line_items_recalc
  after insert or update or delete on public.po_line_items
  for each row execute procedure public.recalc_po_total();

-- ---------- Row Level Security ----------
alter table public.profiles        enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.po_line_items   enable row level security;

-- Profiles: everyone signed in can read (to show requester names);
-- users can edit their own name; only admins can change roles.
create policy "profiles: read" on public.profiles
  for select to authenticated using (true);

-- Lets the app create a profile for a user who signed up before the trigger existed.
create policy "profiles: create own" on public.profiles
  for insert to authenticated
  with check (id = auth.uid() and role = 'requester');

create policy "profiles: update own name" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role());

create policy "profiles: admin update" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Purchase orders
create policy "po: requester reads own, approvers read all" on public.purchase_orders
  for select to authenticated
  using (requester_id = auth.uid() or public.is_approver());

create policy "po: create own" on public.purchase_orders
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');

-- Requesters may edit their own PO only while pending, and can't self-approve.
create policy "po: requester edits own pending" on public.purchase_orders
  for update to authenticated
  using (requester_id = auth.uid() and status = 'pending')
  with check (requester_id = auth.uid() and status = 'pending' and approver_id is null);

-- Approvers/admins can decide.
create policy "po: approver decides" on public.purchase_orders
  for update to authenticated
  using (public.is_approver())
  with check (public.is_approver());

create policy "po: requester deletes own pending" on public.purchase_orders
  for delete to authenticated
  using ((requester_id = auth.uid() and status = 'pending') or public.is_admin());

-- Line items follow their parent PO.
create policy "items: read" on public.po_line_items
  for select to authenticated
  using (exists (select 1 from public.purchase_orders p
                 where p.id = po_id and (p.requester_id = auth.uid() or public.is_approver())));

create policy "items: write while pending" on public.po_line_items
  for all to authenticated
  using (exists (select 1 from public.purchase_orders p
                 where p.id = po_id and p.requester_id = auth.uid() and p.status = 'pending'))
  with check (exists (select 1 from public.purchase_orders p
                 where p.id = po_id and p.requester_id = auth.uid() and p.status = 'pending'));

-- ---------- Receipt uploads (Supabase Storage) ----------
-- Private bucket; files are stored as  <user id>/<random>-<filename>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760,
        array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do nothing;

create policy "receipts: upload to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "receipts: owner or approver reads" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_approver()));

create policy "receipts: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Bootstrap: make yourself admin ----------
-- After you sign in for the first time, run:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
