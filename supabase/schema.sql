-- Shared budget tracker schema
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table households (
  id             uuid primary key default gen_random_uuid(),
  member_1_id    uuid not null references auth.users(id),
  member_2_id    uuid references auth.users(id),
  monthly_budget numeric,
  created_at     timestamptz not null default now()
);

create table categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  icon         text,
  color        text,
  created_at   timestamptz not null default now()
);

create table trips (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  start_date   date,
  end_date     date,
  budget       numeric,
  created_at   timestamptz not null default now()
);

create table expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  category_id  uuid references categories(id) on delete set null,
  trip_id      uuid references trips(id) on delete set null,
  amount       numeric not null check (amount > 0),
  note         text,
  paid_by      uuid not null references auth.users(id),
  date         date not null default current_date,
  created_at   timestamptz not null default now()
);

create table budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  category_id   uuid not null references categories(id) on delete cascade,
  month         date not null, -- first of month, e.g. 2026-08-01
  limit_amount  numeric not null,
  unique (household_id, category_id, month)
);

create index expenses_household_date_idx on expenses (household_id, date);
create index expenses_trip_idx on expenses (trip_id);
create index budgets_household_month_idx on budgets (household_id, month);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table households enable row level security;
alter table categories enable row level security;
alter table trips enable row level security;
alter table expenses enable row level security;
alter table budgets enable row level security;

-- households: a user can see/update the household they belong to
create policy "household members can select" on households
  for select using (auth.uid() = member_1_id or auth.uid() = member_2_id);

create policy "household members can update" on households
  for update using (auth.uid() = member_1_id or auth.uid() = member_2_id);

-- helper condition reused via subquery: auth.uid() must match a household's members
create policy "household members can select categories" on categories
  for select using (
    exists (
      select 1 from households h
      where h.id = categories.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

create policy "household members can modify categories" on categories
  for all using (
    exists (
      select 1 from households h
      where h.id = categories.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

create policy "household members can select trips" on trips
  for select using (
    exists (
      select 1 from households h
      where h.id = trips.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

create policy "household members can modify trips" on trips
  for all using (
    exists (
      select 1 from households h
      where h.id = trips.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

create policy "household members can select expenses" on expenses
  for select using (
    exists (
      select 1 from households h
      where h.id = expenses.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

create policy "household members can modify expenses" on expenses
  for all using (
    exists (
      select 1 from households h
      where h.id = expenses.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

create policy "household members can select budgets" on budgets
  for select using (
    exists (
      select 1 from households h
      where h.id = budgets.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

create policy "household members can modify budgets" on budgets
  for all using (
    exists (
      select 1 from households h
      where h.id = budgets.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
-- Enable Realtime on the expenses table from the Supabase dashboard:
-- Database > Replication > toggle "expenses" on. (Or via SQL below.)
alter publication supabase_realtime add table expenses;
