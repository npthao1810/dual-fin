-- Adds a per-day income rate to households, used to calculate month-to-date
-- savings (days elapsed this month × daily_income − amount spent this month).
-- Run this once in the Supabase SQL editor against your existing database.

alter table households
  add column daily_income numeric not null default 1000000;
