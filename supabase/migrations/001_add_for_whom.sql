-- Adds the "for" field to expenses: who the expense was for (anh / em / us).
-- Run this once in the Supabase SQL editor against your existing database.

alter table expenses
  add column for_whom text not null default 'us' check (for_whom in ('anh', 'em', 'us'));
