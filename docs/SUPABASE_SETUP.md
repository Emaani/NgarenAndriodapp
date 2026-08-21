# Ngaren — Supabase implementation guide

This is the step-by-step you asked for. Do it once against the **same Supabase
project the web command centre uses** (the app and the web app must share one
project so the herd, telemetry, and photos are the same data).

Total time: ~15 minutes. Nothing here is destructive — every migration is
**additive and idempotent** (safe to run more than once).

---

## What you'll do

1. Apply 3 SQL migrations (delegated seats, animal-photos bucket, approve_records).
2. Confirm the `animal-photos` storage bucket exists and is public.
3. Confirm the EAS build env vars point at this project.
4. Smoke-test: register an animal on the tablet → see it in `animal_lineage`.

You need: the Supabase project **owner/admin** login, nothing else.

---

## Step 1 — Apply the SQL migrations

Two ways. **Option A (dashboard)** is easiest and needs no tooling.

### Option A — SQL Editor (recommended)

1. Open **https://supabase.com/dashboard** → your project → **SQL Editor** (left sidebar) → **New query**.
2. Run these three files **in order**. For each: open the file, copy its whole
   contents into the editor, press **Run**. Expect “Success. No rows returned.”

   | Order | File | What it creates |
   |------|------|-----------------|
   | 1 | `supabase/migrations/20260806120000_delegated_seats_foundation.sql` | Organizations, seats, permissions, per-seat billing tables + `has_permission()`. All new tables — touches nothing existing. |
   | 2 | `supabase/migrations/20260806130000_animal_photos_bucket.sql` | The `animal-photos` storage bucket + its RLS (public read, owner-folder write). |
   | 3 | `supabase/migrations/20260821090000_approve_records_permission.sql` | The `approve_records` capability for the Field-Operations checker. |

   > These files live in the **livestock-command-center** repo under
   > `supabase/migrations/`. They are the source of truth — don't retype them.

3. If a statement ever says an object “already exists”, that's fine — the scripts
   guard for it. You can re-run any of them safely.

### Option B — Supabase CLI (if you use it)

From the `livestock-command-center` repo, with the CLI linked to the project:

```bash
supabase db push
```

This applies any migrations the remote project hasn't seen yet, in timestamp order.

---

## Step 2 — Verify the storage bucket

1. Dashboard → **Storage**. You should see a bucket named **`animal-photos`**
   marked **Public**.
2. If it isn't there, re-run migration #2 from Step 1.

Why public: animal photos are shown on profiles and the web command centre.
Writes are still locked down — a signed-in user can only upload into their own
`user_id/…` folder (enforced by the bucket's RLS policy). No one can overwrite
another user's photos.

---

## Step 3 — Confirm the build points at this project

The Android app reads its backend purely from env vars — nothing is hardcoded.
The current EAS **preview** build already has these set (I can see them load at
build time), but confirm they match **this** project:

1. Dashboard → **Project Settings → API**. Copy:
   - **Project URL** (e.g. `https://xxxx.supabase.co`)
   - **anon / public** key (the publishable one — it's RLS-gated and safe to ship)
2. In EAS → your project → **Environment variables** (preview environment), confirm:

   | Variable | Value |
   |----------|-------|
   | `EXPO_PUBLIC_SUPABASE_URL` | the Project URL from step 3.1 |
   | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | the anon/public key from step 3.1 |

   > ⚠️ Only ever use the **anon/public** key in the app. Never the **service_role**
   > key — that bypasses RLS and must stay server-side only.

If you change either value, trigger a new build so it's baked in.

Optional (leave unset for MVP):
- `EXPO_PUBLIC_SENTRY_DSN` — crash reporting. Empty = disabled, app runs fine.
- `EXPO_PUBLIC_CERES_PLATFORM_URL` / `EXPO_PUBLIC_NGAREN_CONSUMER_ID` — the old
  platform-api path. Leave empty; the app uses Supabase-direct.

---

## Step 4 — Smoke test (5 minutes)

Do this once the migrations are applied and the app is installed:

1. **Sign in** on the tablet with a real Supabase user (an admin/vet account can
   insert herd rows; a plain farmer can register locally but the write-back to
   `animal_lineage` needs an insert-capable role — see the note below).
2. **Register an animal**: Home → *Register animal* → complete sections a–e →
   *Create Animal Account*.
3. In Supabase → **Table Editor → `animal_lineage`**: the new row should appear,
   with `animal_id` = the AAN (e.g. `NGR-XXXXXX-XXXX`) and `photo_url` set if you
   attached photos.
4. In **Storage → animal-photos**: the uploaded JPEG should be under
   `<user_id>/<AAN>/…jpg`.
5. Open the animal in the app → it now reads back from `animal_lineage`.
   Stock-take, vet call-out, and reports show the same herd.

### About who can write the herd

`animal_lineage` RLS lets **admins and vets** `INSERT`; **farmers** get
`SELECT` + `UPDATE` only. So:

- An **admin/vet** capture writes straight through to `animal_lineage` (syncs to web).
- A **farmer** capture is saved **on the device** and shown in the app, but the
  write-back to `animal_lineage` no-ops until an insert-capable user is involved.
  This is by design (the maker-checker model) and the app degrades gracefully —
  it never errors, it just keeps the animal local.

If you want farmers' own captures to write to `animal_lineage` directly, that's a
one-line RLS policy change (add a farmer `INSERT` policy scoped to
`assigned_farmer_id = auth.uid()`). Tell me and I'll prepare that migration — I
left it out because it changes your data-ownership model and that's your call.

---

## What already works without any backend change

Ceres telemetry (`ceres_telemetry`) and the herd (`animal_lineage`) are existing
tables — the app reads them directly, no migration needed. The three migrations
above only add the **seats/permissions** system, the **photo bucket**, and the
**approve_records** capability. If you applied nothing, the app still runs (it
falls back to sample data and shows an honest "showing last known data" banner).

---

## Quick troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| App shows sample animals, not your herd | Env vars not set / wrong project | Step 3 — set `EXPO_PUBLIC_SUPABASE_URL` + `ANON_KEY`, rebuild |
| "showing last known data" banner | App can't reach Supabase or a query failed | Check the URL/key and that the device is online |
| Registered animal not in `animal_lineage` | Signed-in user is a farmer (SELECT/UPDATE only) | Sign in as admin/vet, or add the farmer INSERT policy (see Step 4) |
| Photo didn't upload | `animal-photos` bucket missing | Re-run migration #2, confirm Step 2 |
| Approvals screen empty for a manager | Seat isn't `farm_manager`/owner | Assign the seat, or grant `approve_records` override |
