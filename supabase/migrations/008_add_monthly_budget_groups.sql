-- Monthly Daily/Trip budget envelopes and per-expense currency selection.
-- Run once in the Supabase SQL editor before deploying the matching app version.

create table if not exists monthly_budget_groups (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  month         date not null,
  daily_limit   numeric not null default 0 check (daily_limit >= 0),
  trip_limit    numeric not null default 0 check (trip_limit >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (household_id, month)
);

alter table monthly_budget_groups enable row level security;

create policy "household members can select monthly budget groups" on monthly_budget_groups
  for select using (
    exists (
      select 1 from households h
      where h.id = monthly_budget_groups.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

create policy "household members can modify monthly budget groups" on monthly_budget_groups
  for all using (
    exists (
      select 1 from households h
      where h.id = monthly_budget_groups.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  ) with check (
    exists (
      select 1 from households h
      where h.id = monthly_budget_groups.household_id
        and (auth.uid() = h.member_1_id or auth.uid() = h.member_2_id)
    )
  );

create index if not exists monthly_budget_groups_household_month_idx
  on monthly_budget_groups (household_id, month);

alter table expenses
  add column if not exists expense_type text not null default 'daily'
    check (expense_type in ('daily', 'trip'));

alter table expenses
  add column if not exists exchange_rate numeric;

-- Preserve the meaning of all existing trip-linked expenses.
update expenses
set expense_type = 'trip'
where trip_id is not null and expense_type = 'daily';

