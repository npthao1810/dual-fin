-- One-time import of historical expenses, 2026-07-15 through 2026-08-20.
-- Run this once in the Supabase SQL editor. Safe to run only once — running it
-- twice will duplicate every row (there's no unique constraint to prevent it).
--
-- Parsing rules applied:
--   1. Amounts written as "92" or "92k" both mean 92,000 VND.
--   2. for_whom: item name contains the standalone word "anh" -> 'anh',
--      "em" -> 'em', otherwise -> 'us'. Word-boundary matching was used by
--      hand so words like "bánh" (different letter, has an accent) or "nem"/
--      "Xem"/"khanh" (which contain the letters a-n-h or e-m only as part of
--      a longer word) are NOT misread as the anh/em marker.
--   3. em_chi: true only where you wrote "- em chi" on the line; that suffix
--      is stripped from the stored name. Everything else defaults to false
--      (anh chi), per your rule.
--   4. category_id is left NULL (Uncategorized) for every row — you didn't
--      specify categories per item, so nothing was guessed. Recategorize in
--      the app afterwards if you want.
--   5. paid_by is set to one of the two household members automatically
--      (whichever is member_1_id) since the schema requires a value there;
--      it has no bearing on anh/em/us or anh-chi/em-chi reporting.
--
-- Flagged while parsing — did NOT include these:
--   - 2026-08-16 "Nước dừa" and "Taxi" both have no amount in your notes,
--     so they're skipped entirely. Add them manually if you have the amounts.
--   - 2026-08-07 has "cá hồi ăn trưa em: 240k - em chi" AND "Ăn trưa cá hồi
--     em: 240k - em chi" — same amount, near-identical description. This
--     looks like the same lunch written down twice. I imported both as given
--     since I can't be sure, but you may want to delete one via History.
--   - The trailing "Cá hồi: 636k" line had no date header of its own; I
--     attached it to 2026-08-20 (the last date mentioned before it). Move it
--     if that's wrong.
--   - 2026-08-14 through 2026-08-16 looks like a Đà Nẵng/Hội An trip (taxi,
--     flight ticket, resort, massage) — none of it is tagged to a Trip here.
--     Say the word if you want me to create a trip and move those rows onto it.

with h as (
  select id as household_id, member_1_id as payer
  from households
  limit 1
)
insert into expenses (household_id, note, amount, for_whom, em_chi, paid_by, date)
select h.household_id, v.note, v.amount, v.for_whom, v.em_chi, h.payer, v.date::date
from h,
(values
  -- 2026-07-15
  ('2026-07-15', 'Trưa bún riêu chung', 92000, 'us', false),
  ('2026-07-15', 'Cafe chung', 168000, 'us', false),
  ('2026-07-15', 'Ăn tối bánh tráng chung', 75000, 'us', false),
  -- 2026-07-16
  ('2026-07-16', 'Ăn trưa chung bánh mì heo quay', 50000, 'us', true),
  ('2026-07-16', 'Trà sữa chung 50 tea', 72000, 'us', true),
  ('2026-07-16', 'Rau má chung', 20000, 'us', true),
  ('2026-07-16', 'Ăn tối chung chả cuốn cá trích', 225000, 'us', false),
  ('2026-07-16', 'Cafe chung Hyme', 102000, 'us', false),
  -- 2026-07-17
  ('2026-07-17', 'Ăn trưa chung', 320000, 'us', false),
  ('2026-07-17', 'Cafe chung', 85000, 'us', false),
  ('2026-07-17', 'Bánh tráng chung', 32000, 'us', true),
  ('2026-07-17', 'Bánh căn chung', 30000, 'us', false),
  ('2026-07-17', 'Siêu thị', 35000, 'us', false),
  -- 2026-07-18
  ('2026-07-18', 'Ăn sáng bánh canh', 160000, 'us', false),
  ('2026-07-18', 'Katinat', 96000, 'us', false),
  ('2026-07-18', 'Ăn tối khói', 2102000, 'us', false),
  -- 2026-07-19
  ('2026-07-19', 'Nước dừa', 17000, 'us', true),
  ('2026-07-19', 'Poke tối', 416000, 'us', false),
  ('2026-07-19', 'Cafe đọc truyện', 105000, 'us', false),
  -- 2026-07-20
  ('2026-07-20', 'Ăn trưa em nem nướng', 86000, 'em', false),
  ('2026-07-20', 'Xem phim', 251000, 'us', false),
  ('2026-07-20', 'Tối gogi', 716000, 'us', false),
  -- 2026-07-21
  ('2026-07-21', 'Ăn trưa anh yogurt', 82000, 'anh', false),
  ('2026-07-21', 'Cafe em orange ball', 70000, 'em', false),
  ('2026-07-21', 'Bánh mì giò ăn tối', 56000, 'us', false),
  ('2026-07-21', 'Nước dừa', 15000, 'us', false),
  -- 2026-07-22
  ('2026-07-22', 'Soumaki ăn trưa em', 153000, 'em', false),
  ('2026-07-22', 'Cafe bakes em', 70000, 'em', false),
  ('2026-07-22', 'Hoa quả', 53000, 'us', false),
  -- 2026-07-23
  ('2026-07-23', 'Cơm heo quay trưa em', 45000, 'em', true),
  ('2026-07-23', 'Cafe slow em', 70000, 'em', false),
  -- 2026-07-24
  ('2026-07-24', 'Ăn trưa em', 82000, 'em', false),
  ('2026-07-24', 'Hoa quả', 19000, 'us', false),
  -- 2026-07-25
  ('2026-07-25', 'Ăn trưa em', 80000, 'em', false),
  ('2026-07-25', 'Hoa quả', 303000, 'us', false),
  ('2026-07-25', 'Ăn tối', 100000, 'us', false),
  -- 2026-07-26
  ('2026-07-26', 'Ăn sáng Hồng Phúc', 280000, 'us', false),
  ('2026-07-26', 'Nem nướng ăn tối', 135000, 'us', false),
  ('2026-07-26', 'Cafe', 135000, 'us', false),
  ('2026-07-26', 'Quần áo em', 586000, 'em', false),
  -- 2026-07-27
  ('2026-07-27', 'Ăn trưa', 192000, 'us', false),
  ('2026-07-27', 'Cafe', 40000, 'us', true),
  ('2026-07-27', 'Ăn tối bánh mì', 42000, 'us', false),
  -- 2026-07-28
  ('2026-07-28', 'Ăn trưa em', 150000, 'em', false),
  ('2026-07-28', 'Ăn trưa anh', 72000, 'anh', false),
  ('2026-07-28', 'Cafe em', 65000, 'em', false),
  ('2026-07-28', 'Tối sashimi', 614000, 'us', false),
  -- 2026-07-29
  ('2026-07-29', 'Ăn trưa em', 144000, 'em', false),
  ('2026-07-29', 'Cafe em', 40000, 'em', true),
  -- 2026-07-30
  ('2026-07-30', 'Hoa quả', 114000, 'us', false),
  ('2026-07-30', 'Cf em', 65000, 'em', false),
  ('2026-07-30', 'Bánh bao em', 23000, 'em', true),
  -- 2026-07-31
  ('2026-07-31', 'Ăn trưa em bún chả', 76000, 'em', true),
  ('2026-07-31', 'Ăn tối anh', 170000, 'anh', false),
  ('2026-07-31', 'Cafe anh', 55000, 'anh', false),
  -- 2026-08-01
  ('2026-08-01', 'Ăn trưa em phở', 95000, 'em', true),
  ('2026-08-01', 'Cafe em', 60000, 'em', true),
  ('2026-08-01', 'Hoa quả', 114000, 'us', false),
  ('2026-08-01', 'Ăn tối em bánh tráng', 20000, 'em', true),
  -- 2026-08-02
  ('2026-08-02', 'Ăn trưa sm nem lụi', 62000, 'us', false),
  ('2026-08-02', 'Cafe em', 65000, 'em', false),
  ('2026-08-02', 'Cafe anh', 55000, 'anh', false),
  ('2026-08-02', 'Nộm anh', 59000, 'anh', false),
  ('2026-08-02', 'Tào phớ anh', 17000, 'anh', false),
  ('2026-08-02', 'Mỳ tôm anh', 40000, 'anh', false),
  -- 2026-08-03
  ('2026-08-03', 'Ăn trưa bánh mì heo quay em', 25000, 'em', true),
  ('2026-08-03', 'Ăn trưa anh nem nướng', 66000, 'anh', false),
  ('2026-08-03', 'Cafe em', 60000, 'em', false),
  ('2026-08-03', 'Bún cá', 96000, 'us', false),
  -- 2026-08-04
  ('2026-08-04', 'Ăn trưa em', 69000, 'em', false),
  ('2026-08-04', 'Ăn trưa anh', 55000, 'anh', false),
  ('2026-08-04', 'Ăn tối', 972000, 'us', false),
  ('2026-08-04', 'Vé xp', 306000, 'us', false),
  -- 2026-08-05
  ('2026-08-05', 'Ăn trưa soumaki anh', 200000, 'anh', false),
  ('2026-08-05', 'Ăn trưa em', 69000, 'em', false),
  ('2026-08-05', 'Ăn tối bún cá chung', 149000, 'us', false),
  -- 2026-08-06
  ('2026-08-06', 'Em ăn trưa', 94000, 'em', false),
  ('2026-08-06', 'Em ăn tối', 60000, 'em', false),
  ('2026-08-06', 'Hoa quả', 78000, 'us', false),
  ('2026-08-06', 'Áo em', 489000, 'em', false),
  -- 2026-08-07
  ('2026-08-07', 'Cá hồi ăn trưa em', 240000, 'em', true),
  ('2026-08-07', 'Cafe em', 75000, 'em', false),
  ('2026-08-07', 'Ăn trưa cá hồi em', 240000, 'em', true),
  -- 2026-08-08
  ('2026-08-08', 'Pasta ăn trưa chung', 500000, 'us', false),
  ('2026-08-08', 'Tối ăn cơm thiên lý chung', 250000, 'us', false),
  ('2026-08-08', 'Trà sữa chung', 148000, 'us', false),
  -- 2026-08-09
  ('2026-08-09', 'Vé xem phim', 386000, 'us', false),
  ('2026-08-09', 'Nước xem phim', 40000, 'us', false),
  ('2026-08-09', 'Ăn trưa đồ Thái chung', 420000, 'us', false),
  ('2026-08-09', 'Hoa quả vỉa hè', 130000, 'us', false),
  ('2026-08-09', 'Hoa quả farmer', 80000, 'us', false),
  ('2026-08-09', 'Áo', 500000, 'us', false),
  ('2026-08-09', 'Xôi ăn tối chung', 40000, 'us', false),
  ('2026-08-09', 'Bánh tráng ăn tối chung', 68000, 'us', false),
  -- 2026-08-10
  ('2026-08-10', 'Ăn trưa em', 134000, 'em', false),
  ('2026-08-10', 'Ăn trưa anh', 80000, 'anh', false),
  ('2026-08-10', 'Cafe em', 55000, 'em', false),
  ('2026-08-10', 'Ăn tối', 56000, 'us', false),
  -- 2026-08-11
  ('2026-08-11', 'Ăn trưa bún chả', 130000, 'us', false),
  ('2026-08-11', 'Cafe em', 60000, 'em', false),
  ('2026-08-11', 'Ăn tối udon', 169000, 'us', false),
  -- 2026-08-12
  ('2026-08-12', 'Ăn trưa anh', 79000, 'anh', false),
  ('2026-08-12', 'Ăn trưa em', 71000, 'em', false),
  ('2026-08-12', 'Tối ăn phở', 150000, 'us', false),
  ('2026-08-12', 'Tối ăn bánh', 180000, 'us', false),
  -- 2026-08-13
  ('2026-08-13', 'Ăn trưa anh', 65000, 'anh', false),
  ('2026-08-13', 'Ăn trưa em', 134000, 'em', false),
  ('2026-08-13', 'Ăn tối em', 76000, 'em', false),
  ('2026-08-13', 'Cafe em', 60000, 'em', false),
  ('2026-08-13', 'Ăn tối anh', 40000, 'anh', false),
  -- 2026-08-14
  ('2026-08-14', 'Taxi ĐN - Hội An', 282000, 'us', false),
  ('2026-08-14', 'Photobooth', 200000, 'us', false),
  ('2026-08-14', 'Bánh mì Madam Khanh', 120000, 'us', false),
  ('2026-08-14', 'Cafe', 160000, 'us', false),
  ('2026-08-14', 'Nước mót', 60000, 'us', false),
  ('2026-08-14', 'Ăn tối cùng Tạ', 450000, 'us', false),
  ('2026-08-14', 'Pub cùng Tạ', 450000, 'us', false),
  ('2026-08-14', 'Grab loanh quanh', 139000, 'us', false),
  -- 2026-08-15
  ('2026-08-15', 'Bánh xèo', 210000, 'us', false),
  ('2026-08-15', 'Massage', 650000, 'us', false),
  ('2026-08-15', 'Taxi Hội An - resort', 103000, 'us', false),
  ('2026-08-15', 'Chè', 61000, 'us', false),
  ('2026-08-15', 'Nước ép', 40000, 'us', false),
  ('2026-08-15', 'Ăn tối mì cay', 370000, 'us', false),
  -- 2026-08-16
  ('2026-08-16', 'Vé máy bay', 5200000, 'us', false),
  ('2026-08-16', 'Cf đồng lúa', 165000, 'us', false),
  ('2026-08-16', 'Bánh bột lọc', 110000, 'us', false),
  ('2026-08-16', 'Bingsu xoài', 205000, 'us', false),
  ('2026-08-16', 'Cafe', 134000, 'us', false),
  ('2026-08-16', 'Gà', 383000, 'us', false),
  ('2026-08-16', 'Gửi xe máy', 92000, 'us', false),
  -- 2026-08-17
  ('2026-08-17', 'Ăn trưa em', 137000, 'em', false),
  ('2026-08-17', 'Ăn trưa anh', 134000, 'anh', false),
  ('2026-08-17', 'Bánh mì ăn tối', 78000, 'us', false),
  ('2026-08-17', 'Bánh bao ăn tối', 20000, 'us', false),
  ('2026-08-17', 'Nước ép', 25000, 'us', false),
  -- 2026-08-18
  ('2026-08-18', 'Ăn trưa em bánh mì', 25000, 'em', true),
  ('2026-08-18', 'Hoa quả', 27000, 'us', false),
  ('2026-08-18', 'Cafe em', 65000, 'em', false),
  ('2026-08-18', 'Ăn tối', 1700000, 'us', false),
  -- 2026-08-19
  ('2026-08-19', 'Ăn trưa em', 70000, 'em', false),
  ('2026-08-19', 'Ăn tối', 230000, 'us', false),
  ('2026-08-19', 'Hoa quả', 170000, 'us', false),
  -- 2026-08-20
  ('2026-08-20', 'Ăn trưa em', 84000, 'em', false),
  ('2026-08-20', 'Ăn trưa anh', 66000, 'anh', false),
  ('2026-08-20', 'Trà sữa anh', 35000, 'anh', false),
  ('2026-08-20', 'Cá hồi', 636000, 'us', false)
) as v(date, note, amount, for_whom, em_chi);
