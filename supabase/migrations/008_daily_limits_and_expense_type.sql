-- Daily household / daily trip limits, plus per-expense Daily/Trip type and
-- exchange rate. Replaces the old `daily_income` with two per-day limits on
-- the household; each period's budget is limit × days elapsed since
-- budget_start_date (or since the 1st, for a single month).
-- Run once in the Supabase SQL editor BEFORE deploying the matching app
-- version. Safe to re-run.

alter table households
  add column if not exists daily_household_limit numeric not null default 0
    check (daily_household_limit >= 0);

alter table households
  add column if not exists daily_trip_limit numeric not null default 0
    check (daily_trip_limit >= 0);

-- Carry the old daily income over as the daily household limit, then retire it.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'households' and column_name = 'daily_income'
  ) then
    update households set daily_household_limit = daily_income where daily_income is not null;
    alter table households drop column daily_income;
  end if;
end $$;

-- An earlier draft of this migration created a monthly_budget_groups table;
-- the limits now live on households instead.
drop table if exists monthly_budget_groups;

alter table expenses
  add column if not exists expense_type text not null default 'daily'
    check (expense_type in ('daily', 'trip'));

alter table expenses
  add column if not exists exchange_rate numeric;

-- Preserve the meaning of all existing trip-linked expenses.
update expenses
set expense_type = 'trip'
where trip_id is not null and expense_type = 'daily';
