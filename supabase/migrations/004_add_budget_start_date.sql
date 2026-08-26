-- Replaces the calendar-month budget/savings window with a fixed start date
-- you set once. Income and spend are now tallied from budget_start_date
-- through today, instead of resetting on the 1st of every month.
-- Run this once in the Supabase SQL editor against your existing database.

alter table households
  add column budget_start_date date not null default current_date;

-- Sets the start date to 2026-07-15 for your household (there's only one,
-- so this updates every row — fine for a single-household app).
update households set budget_start_date = '2026-07-15';
