# Senior Helpers Time Tracker

Clock in/out, breaks, and leave requests for Senior Helpers' remote hourly
workers, plus an owner dashboard and bi-weekly pay reports.

Full product spec: see the build instructions this repo was generated from.
Decisions made where the spec left something open are logged in
[`DECISIONS.md`](./DECISIONS.md).

## Stack

Next.js (App Router) + TypeScript + Tailwind, backed by Supabase
(Postgres, Auth, Row Level Security, Realtime), deployed on Vercel.

## Prerequisites

- Node.js 18.18+
- A [Supabase](https://supabase.com) project (free tier is fine)
- The [Supabase CLI](https://supabase.com/docs/guides/cli) if you want to run
  migrations locally (`npx supabase` works too, no global install needed)

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Create a Supabase project** at https://supabase.com/dashboard and grab,
   from Project Settings → API:
   - Project URL
   - `anon` public key
   - `service_role` secret key (server-only, never commit it)

3. **Environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
   `SUPABASE_SERVICE_ROLE_KEY` from step 2.

4. **Run migrations** against your Supabase project. Either paste the files
   in `supabase/migrations/` (in order) into the Supabase SQL editor, or with
   the CLI:

   ```bash
   npx supabase link --project-ref YOUR-PROJECT-REF
   npx supabase db push
   ```

5. **Create the first owner account.** There is no public sign-up page by
   design. Set `FIRST_OWNER_EMAIL`, `FIRST_OWNER_PASSWORD`, and
   `FIRST_OWNER_NAME` in `.env.local`, then:

   ```bash
   npm run create-owner
   ```

6. **(Optional) Seed demo data** — an owner, three employees, two weeks of
   time entries, and a few leave requests in every status. The script
   refuses to run unless `NEXT_PUBLIC_SUPABASE_SEED_ALLOW` is set to your
   project ref (a guard against seeding a real business's data):

   ```bash
   NEXT_PUBLIC_SUPABASE_SEED_ALLOW=your-project-ref npm run seed
   ```

7. **Run the app**

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000 and sign in with the owner account from step 5.

## Testing

```bash
npm run test    # Vitest — lib/payroll.ts and other pure logic
npm run lint    # ESLint
npm run build   # Next.js production build (also type-checks)
```

SQL/RLS tests live in `supabase/tests/` as plain `.sql` files using
`pgTAP`-style assertions; run them with the Supabase CLI's `db test` command
or paste them into the SQL editor against a disposable project.

A Playwright end-to-end smoke test was deferred for this MVP to keep build
time reasonable (see `DECISIONS.md`); the RLS and payroll unit tests cover
the highest-risk logic in the meantime.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add the same environment variables from `.env.local` (except
   `NEXT_PUBLIC_SUPABASE_SEED_ALLOW`, which should stay unset in production)
   in the Vercel project's Environment Variables settings.
4. Deploy. Run migrations against the production Supabase project the same
   way as step 4 above, and run `npm run create-owner` once, locally, pointed
   at production env vars, to create the first owner.

## Project structure

```
src/app/(owner)/...      Owner screens: dashboard, employees, leave-requests, reports, settings
src/app/(employee)/...   Employee screens: clock, leave, history, team
src/lib/payroll.ts       Pure, unit-tested pay/overtime calculation
src/lib/time.ts          Timezone-aware date/time helpers
supabase/migrations/     SQL schema, RLS policies, RPC functions
supabase/tests/          SQL/RLS tests
scripts/create-owner.ts  One-time first-owner bootstrap
scripts/seed.ts          Demo data for local development
```
