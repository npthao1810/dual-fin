-- Follow-up fixes after importing 001_july_august_2026_expenses.sql.
-- Run this once, after that import, in the Supabase SQL editor.

-- 1. Remove the duplicate Aug 7 salmon lunch. Two near-identical lines were
--    in the original notes ("cá hồi ăn trưa em" and "Ăn trưa cá hồi em",
--    same amount, same day) — keeping the first, deleting the second.
delete from expenses
where date = '2026-08-07'
  and note = 'Ăn trưa cá hồi em'
  and amount = 240000;

-- 2. Create the Hội An trip (2026-08-14 to 2026-08-16) and move every
--    expense in that date range onto it.
with new_trip as (
  insert into trips (household_id, name, start_date, end_date)
  select id, 'Hội An', '2026-08-14', '2026-08-16'
  from households
  limit 1
  returning id, household_id
)
update expenses e
set trip_id = new_trip.id
from new_trip
where e.household_id = new_trip.household_id
  and e.date between '2026-08-14' and '2026-08-16';
