-- Categorizes the imported historical expenses (and any future rows matching
-- the same keywords). Run this once in the Supabase SQL editor, after
-- 001_july_august_2026_expenses.sql and 002_fixups.sql.
--
-- Rules applied:
--   - Food: note contains "ăn" (the Vietnamese eat-verb) OR a specific dish
--     name (bánh, bún, cơm, gà, mỳ/mì, nộm, poke, sashimi, gogi, tào phớ,
--     nem, phở, cá hồi, bingsu, soumaki, yogurt, udon, pasta).
--   - Cafe: note contains "cafe" or the standalone word "cf".
--   - Snack: note contains "hoa quả".
--
-- Deliberately NOT matched (left uncategorized — none of your three rules
-- covered these, so I didn't guess): Chè, Trà sữa, Nước dừa/ép/mót, Rau má,
-- Katinat, Siêu thị, Massage, Photobooth, Taxi/Grab/Vé máy bay, Quần áo/Áo,
-- Gửi xe máy, Xem phim/Vé xem phim/Nước xem phim, Pub. Run the SELECT at the
-- bottom of this file to see the full uncategorized list and adjust by hand
-- (via the app, or another update statement) if you want them sorted too.
--
-- Word-boundary note: "ăn" only matches the accented Vietnamese letter, so
-- it does not false-match "Hội An" (plain "An", no accent) or "Bánh" (which
-- is a different word, spelled with "á" not "a"). "cf" is matched as a
-- whole word so it won't match inside any other word.

with h as (select id as household_id from households limit 1)
insert into categories (household_id, name, icon, color)
select h.household_id, v.name, v.icon, v.color
from h,
(values
  ('Cafe', '☕', '#fb923c'),
  ('Snack', '🍉', '#fdba74')
) as v(name, icon, color)
where not exists (
  select 1 from categories c where c.household_id = h.household_id and c.name = v.name
);

with h as (select id as household_id from households limit 1),
cafe as (select c.id from categories c, h where c.household_id = h.household_id and c.name = 'Cafe')
update expenses
set category_id = (select id from cafe)
where category_id is null
  and (note ilike '%cafe%' or note ~* '\mcf\M');

with h as (select id as household_id from households limit 1),
snack as (select c.id from categories c, h where c.household_id = h.household_id and c.name = 'Snack')
update expenses
set category_id = (select id from snack)
where category_id is null
  and note ilike '%hoa quả%';

with h as (select id as household_id from households limit 1),
food as (select c.id from categories c, h where c.household_id = h.household_id and c.name = 'Food')
update expenses
set category_id = (select id from food)
where category_id is null
  and (
    note ilike '%ăn%' or note ilike '%bánh%' or note ilike '%bún%' or note ilike '%cơm%'
    or note ilike '%gà%' or note ilike '%mỳ%' or note ilike '%mì%' or note ilike '%nộm%'
    or note ilike '%poke%' or note ilike '%sashimi%' or note ilike '%gogi%'
    or note ilike '%tào phớ%' or note ilike '%nem%' or note ilike '%phở%'
    or note ilike '%cá hồi%' or note ilike '%bingsu%' or note ilike '%soumaki%'
    or note ilike '%yogurt%' or note ilike '%udon%' or note ilike '%pasta%'
  );

-- Review what's still uncategorized:
select date, note, amount from expenses where category_id is null order by date;
