# Purchase Order System

A small web app for submitting, approving, and tracking purchase orders.

- **Requesters** fill out the PO form, upload a receipt (or promise to turn one in), and see the status of everything they've submitted.
- **Approvers** see a queue of pending POs and approve or deny each one with a note.
- **Admins** do all of the above plus assign roles.

Built with Next.js + Supabase (Postgres, auth, file storage). Hosted for free on Vercel + Supabase.

---

## Setup (about 20 minutes)

You'll create three free accounts: **Supabase** (database + login), **Vercel** (hosting), and **GitHub** (where the code lives so Vercel can deploy it). If you already have any of these, skip that step.

### 1. Put the code on GitHub

1. Sign in at github.com → **New repository** → name it `po-system`, Private → Create.
2. Upload this folder's contents (drag-and-drop on the repo page works, or use `git push`). Don't upload `node_modules` or `.env.local`.

### 2. Create the Supabase project

1. Sign in at supabase.com → **New project**. Pick a name, a strong database password (save it), and the region closest to you.
2. Wait ~1 minute for it to provision.
3. Left sidebar → **SQL Editor** → **New query**. Paste the entire contents of `supabase/schema.sql` and click **Run**. You should see "Success. No rows returned."
4. Left sidebar → **Project Settings → API**. Copy two values; you'll need them in step 4:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long string under "Project API keys")

### 3. Turn on Google sign-in

**In Google Cloud (one-time):**

1. Go to console.cloud.google.com → create a project (any name).
2. **APIs & Services → OAuth consent screen** → External → fill in app name and your email → Save. Under *Audience*/publishing, you can leave it in Testing and add your users' emails as test users, or click **Publish** so anyone with a Google account can attempt to sign in (they still can't do anything until they have a role, and new users only get "requester").
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → Web application.
   - Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
     (replace with your Project URL from step 2, keeping `/auth/v1/callback` on the end)
   - Create → copy the **Client ID** and **Client secret**.

**In Supabase:**

4. **Authentication → Sign In / Providers → Google** → Enable → paste Client ID and Client secret → Save.
5. **Authentication → URL Configuration**:
   - Site URL: your Vercel URL once you have it (step 4), e.g. `https://po-system.vercel.app`
   - Redirect URLs: add `https://po-system.vercel.app/**` and `http://localhost:3000/**`

If Google setup gives you trouble, skip it: the login page also has email + password, and you can invite users from **Authentication → Users → Invite user**.

### 4. Deploy on Vercel

1. Sign in at vercel.com with GitHub → **Add New → Project** → import `po-system`.
2. Before clicking Deploy, open **Environment Variables** and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon public key
3. **Deploy.** In ~2 minutes you'll get a URL like `https://po-system.vercel.app`.
4. Go back to Supabase → Authentication → URL Configuration and set that URL as the Site URL (step 3.5) if you hadn't yet.

### 5. Make yourself admin

1. Open your Vercel URL and sign in (Google or invited email).
2. In Supabase → **SQL Editor**, run:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Reload the app. You'll now see **Approvals** and **Users** in the nav. From **Users** you can promote anyone else — everyone starts as a requester.

### Adding users

- **Google:** they just sign in. They'll appear in Users as a requester; promote as needed.
- **Email/password:** Supabase → Authentication → Users → **Invite user**. They get an email to set a password.

---

## Customizing the form

| What | Where |
|---|---|
| Department list, payment timing/method labels | `src/lib/po-fields.ts` |
| Add a brand-new question without a DB change | `CUSTOM_FIELDS` in `src/lib/po-fields.ts` (stored in the `custom_fields` JSON column) |
| Rearrange / relabel the form | `src/components/POForm.tsx` |
| Change what the detail page shows | `src/app/po/[id]/page.tsx` |
| Add a real column | `supabase/schema.sql` (then `alter table` in the SQL editor), `src/lib/types.ts`, `src/app/po/actions.ts` |
| Receipt file size / types | The `insert into storage.buckets` block in `schema.sql` (default 10 MB; images and PDF) |

## Running locally

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev                  # http://localhost:3000
```

## How access control works

Security lives in the database (Postgres row-level security), not just the UI:

- Requesters can only read/edit/delete their own POs, and only while pending.
- Requesters cannot set approval fields or change their own role.
- Approvers and admins can read everything and record decisions.
- Receipts are in a private bucket; only the uploader and approvers can open them (via short-lived signed links).
- Only admins can change roles.

## Project layout

```
supabase/schema.sql        database tables, triggers, security policies, storage bucket
src/proxy.ts               keeps sessions fresh, redirects signed-out users to /login
src/lib/supabase/          Supabase client helpers
src/lib/po-fields.ts       dropdown options + optional extra fields
src/lib/types.ts           TypeScript types
src/components/POForm.tsx  the purchase order form
src/app/login              sign-in page (Google + email/password)
src/app/page.tsx           "My POs"
src/app/po/new             new PO
src/app/po/[id]            PO detail + approve/deny
src/app/po/[id]/edit       edit a pending PO
src/app/approvals          approver queue
src/app/admin/users        role management
```
