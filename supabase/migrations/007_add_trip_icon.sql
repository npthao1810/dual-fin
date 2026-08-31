-- Per-trip icon (emoji), shown instead of the hardcoded ✈️.
-- Safe to re-run.

alter table trips
  add column if not exists icon text;
