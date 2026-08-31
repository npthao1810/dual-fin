-- Foreign-currency trips (e.g. Korea/Japan): a trip can carry its own
-- currency + a manually-entered exchange rate, and expenses under it
-- snapshot what was actually typed (original_amount/currency) alongside
-- the existing `amount`, which stays VND-converted so every budget/chart/
-- dashboard query keeps working unchanged.
-- Safe to re-run.

alter table trips
  add column if not exists currency text;

alter table trips
  add column if not exists exchange_rate numeric;

alter table expenses
  add column if not exists original_amount numeric;

alter table expenses
  add column if not exists currency text;
