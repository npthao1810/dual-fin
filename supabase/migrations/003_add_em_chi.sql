-- Adds a "who actually paid" marker to expenses: em_chi = true means em paid,
-- false (the default) means anh paid. Independent of the "for" field, which
-- tracks who the expense benefits rather than who paid for it.
-- Run this once in the Supabase SQL editor against your existing database.

alter table expenses
  add column em_chi boolean not null default false;
