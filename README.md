# Budget Tracker

A shared expense and budget tracker PWA for two people. React + Vite + Tailwind, Supabase
(Postgres, Auth, Realtime) as the backend, deployed free on Vercel.

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql) — it creates all five
   tables, enables Row Level Security, and adds the household-membership policies.
3. In **Authentication > Users**, manually create two user accounts (yours and your partner's) —
   signup is not open, so this is the only way in.
4. In **Table Editor > households**, insert one row with `member_1_id` and `member_2_id` set to
   the two users' UUIDs (from the Authentication tab), and optionally a `monthly_budget`.
5. Confirm Realtime is on for `expenses`: **Database > Replication**, toggle it on if the SQL
   script's `alter publication` line didn't already enable it.
6. Copy the project URL and anon public key from **Settings > API**.

## 2. Configure the app locally

```bash
cp .env.example .env
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.6.

```bash
npm install
npm run dev
```

Sign in with one of the two accounts you created. Add a few categories in Settings before
logging expenses.

## 3. Deploy

1. Push this repo to a GitHub repository.
2. Import it into [Vercel](https://vercel.com), framework preset "Vite".
3. Add the two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel project
   settings, then deploy.
4. On iPhone: open the deployed URL in Safari → Share → Add to Home Screen.
   On Android: open it in Chrome → menu → Install app.

## Notes

- The app-icon files in `public/icons/` are solid-color placeholders — swap in real 192×192 and
  512×512 PNGs before you care about how the home-screen icon looks.
- The household's overall `monthly_budget` is edited directly in the Supabase table editor for
  now; per-category budgets are editable in the app's Settings screen.
