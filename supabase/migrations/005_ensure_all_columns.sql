-- Safety-net migration: re-adds every column expenses/households should
-- have by now, using IF NOT EXISTS so it's harmless to run even if some of
-- them are already there. Run this if you ever get a "column ... does not
-- exist" error again — it's always safe to re-run.

alter table expenses
  add column if not exists for_whom text not null default 'us' check (for_whom in ('anh', 'em', 'us'));

alter table expenses
  add column if not exists em_chi boolean not null default false;

alter table households
  add column if not exists daily_income numeric not null default 1000000;

alter table households
  add column if not exists budget_start_date date not null default current_date;
