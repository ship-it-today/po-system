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

*Already done for this project.* Your values:

```
NEXT_PUBLIC_SUPABASE_URL=https://elymujyazvyupmdmxzxe.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_BIRSVWRXKEhQ01VEKZNrtQ__Q8FsoAQ
```

Still to do if you haven't yet: left sidebar → **SQL Editor** → **New query** → paste the entire contents of `supabase/schema.sql` → **Run**. You should see "Success. No rows returned."

(If you ever need the values again: **Project Settings → API Keys**, or the **Connect** button → *App Frameworks* tab. Use the *publishable* key; never the *secret* key.)

### 3. Sign-in setup (email/password for now)

1. **Authentication → Sign In / Providers** → make sure **Email** is enabled (it is by default).
2. Optional but recommended: in the Email provider settings, turn off **Allow new users to sign up** so only invited people get accounts. The app has no public sign-up form either way.
3. **Authentication → URL Configuration** (do this after step 4 gives you your Vercel URL):
   - Site URL: your Vercel URL, e.g. `https://po-system.vercel.app`
   - Redirect URLs: add `https://po-system.vercel.app/**` and `http://localhost:3000/**`

   Set this *before* inviting anyone — invite emails link to the Site URL.

Google sign-in is optional and can be added any time; see **Adding Google sign-in later** at the bottom.

### 4. Deploy on Vercel

1. Sign in at vercel.com with GitHub → **Add New → Project** → import `po-system`.
2. Before clicking Deploy, open **Environment Variables** and add exactly these two (names matter):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://elymujyazvyupmdmxzxe.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_BIRSVWRXKEhQ01VEKZNrtQ__Q8FsoAQ`
3. **Deploy.** In ~2 minutes you'll get a URL like `https://po-system.vercel.app`.
4. Go back to Supabase → Authentication → URL Configuration and set that URL as the Site URL (step 3.3).

### 5. Create your account and make yourself admin

1. Supabase → **Authentication → Users → Add user → Create new user**. Enter your email and a password and tick **Auto confirm user**.
2. Open your Vercel URL and sign in with that email and password.
3. In Supabase → **SQL Editor**, run (with your email):
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
4. Reload the app. You'll now see **Approvals** and **Users** in the nav. From **Users** you can promote anyone else — everyone starts as a requester.

### Adding users

Supabase → **Authentication → Users → Invite user**. They get an email with a link to set a password, then appear on your **Users** page as a requester; promote to approver or admin there.

If you'd rather not rely on email delivery, use **Add user → Create new user** with a temporary password and tick *Auto confirm user*, then tell them the password.

### Adding Google sign-in later

**In Google Cloud (one-time):**

1. Go to console.cloud.google.com → create a project (any name).
2. **APIs & Services → OAuth consent screen** → External → fill in app name and your email → Save. Either add your users as test users, or **Publish** the app so any Google account can sign in (new users only get the "requester" role until you promote them).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → Web application.
   - Authorized redirect URI: `https://elymujyazvyupmdmxzxe.supabase.co/auth/v1/callback`
   - Create → copy the **Client ID** and **Client secret**.

**In Supabase:**

4. **Authentication → Sign In / Providers → Google** → Enable → paste Client ID and Client secret → Save.

That's it — the "Continue with Google" button on the login page starts working immediately. Google users appear in Users as requesters.

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
src/app/page.tsx           home: the PO form
src/app/history            "My POs" (the user's own history)
src/app/account            account info, display name, password change
src/app/po/[id]            PO detail + approve/deny
src/app/po/[id]/edit       edit a pending PO
src/app/approvals          approver queue ("All POs" for admins)
src/app/admin/users        role management
```
