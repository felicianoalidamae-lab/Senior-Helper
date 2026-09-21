# Decisions log

One line per decision made where the spec was silent, in build order.

- No `logo.png` was present in the repo at build time (spec says it's in the project folder; it wasn't). Built a simple wordmark SVG placeholder (`public/logo.svg`) in the brand colors instead. Replace `public/logo.svg` with the real logo when available; the `Logo` component (`src/components/logo.tsx`) is the only place that references it.
- Package manager: npm (matches `package-lock.json`, simplest default for Vercel).
- Auth session handling: `@supabase/ssr` with cookie-based sessions (Next.js App Router standard), middleware-based route guards by role.
- Realtime "today board": Supabase Realtime channel on `time_entries`/`breaks`/`leave_requests`, with a 30s polling fallback timer in case a realtime event is missed.
- PDF export uses `@react-pdf/renderer` rendered in a Route Handler (`app/api/reports/pdf/route.ts`), returned as a binary response.
- CSV export is streamed as plain text from a Route Handler, UTF-8 BOM prefixed, with `=`, `+`, `-`, `@` leading characters escaped by prefixing a single quote.
- `today_board` is implemented as a Postgres view filtered through RLS-friendly `security definer` function `today_board()` rather than a raw view, so the "leave type hidden from coworkers" rule is enforced server-side, not just in the UI.
- Employee invite flow uses Supabase Admin `inviteUserByEmail`, called from a server-only Route Handler using the service role key (never exposed to the client).
- First owner account: created via `npm run create-owner` script (documented in README), which uses the service role key to create the auth user + `profiles` row with `role = 'owner'`.
- Seed script (`npm run seed`) refuses to run unless `SUPABASE_URL` contains `localhost`, `127.0.0.1`, or the project ref matches `NEXT_PUBLIC_SUPABASE_SEED_ALLOW` env var — see script comments.
- Money type: integer cents everywhere in the DB and in `lib/payroll.ts`; only formatted to `$x.xx` at the UI/PDF edge.
- Timezone math uses the `Intl.DateTimeFormat` / `Intl` APIs (no extra date library) via small helpers in `lib/time.ts`, to keep `lib/payroll.ts` dependency-free and easy to unit test.
- Overtime rounding: regular pay and overtime pay for a day are each rounded to the cent independently, then reconciled so they sum exactly to the day's total (see `lib/payroll.ts` `splitDayAmount`).
- Pinned `next@14.2.35` (latest patched 14.x) rather than jumping to Next 15/16, to stay on the stable App Router APIs this spec was written against. `npm audit` still flags a transitive `postcss` advisory bundled inside `next`'s own dependency tree (build-time CSS parsing only, not a runtime/browser risk); fixing it requires an upstream Next major bump, left as a follow-up.
- Playwright e2e smoke test is deferred (documented as a follow-up in README) to keep the MVP build time reasonable; Vitest unit coverage on `lib/payroll.ts` and SQL RLS tests are implemented per §9 instead.
