import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { useExpensesWithPending } from '../hooks/useExpensesWithPending'
import { useBudgets } from '../hooks/useBudgets'
import { daysBetweenInclusive, firstOfMonth, formatCurrency, monthRange, toISODate } from '../lib/format'
import { categoryIcon } from '../lib/categoryIcons'

const FOR_LABELS = {
  anh: { label: 'Anh', icon: '/icons/nav/anh.png' },
  em: { label: 'Em', icon: '/icons/nav/em.png' },
  us: { label: 'Us', icon: '/icons/nav/us.png' },
}

function monthLabelFor(monthStartISO) {
  const [y, m, d] = monthStartISO.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function monthDayLabelFor(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

/** "Since <start date>" + one option per month from budgetStartDate's month through the current month, newest first. */
function buildPeriodOptions(budgetStartDate) {
  const soFarLabel = budgetStartDate ? `Since ${monthDayLabelFor(budgetStartDate)}` : 'So far'
  const options = [{ value: 'so_far', label: soFarLabel }]
  if (!budgetStartDate) return options

  const [startY, startM] = budgetStartDate.split('-').map(Number)
  const now = new Date()
  let y = now.getFullYear()
  let m = now.getMonth() + 1

  while (y > startY || (y === startY && m >= startM)) {
    const value = `${y}-${String(m).padStart(2, '0')}-01`
    options.push({ value, label: monthLabelFor(value) })
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return options
}

export default function Dashboard() {
  const { household } = useHousehold()
  const today = toISODate(new Date())
  const budgetStartDate = household?.budget_start_date ?? null
  const currentMonth = firstOfMonth()
  const { expenses, loading } = useExpensesWithPending({ startDate: budgetStartDate, endDate: today })

  const [trips, setTrips] = useState([])
  useEffect(() => {
    if (!household) return
    supabase
      .from('trips')
      .select('id, name, icon, budget')
      .eq('household_id', household.id)
      .then(({ data }) => setTrips(data ?? []))
  }, [household])

  const [selectedPeriod, setSelectedPeriod] = useState(currentMonth)
  const periodOptions = buildPeriodOptions(budgetStartDate)
  const selectedLabel = periodOptions.find((o) => o.value === selectedPeriod)?.label ?? 'So far'

  const isSoFar = selectedPeriod === 'so_far'
  const isCurrentMonth = selectedPeriod === currentMonth
  const showsToday = isSoFar || isCurrentMonth

  let periodStart, periodEnd
  if (isSoFar) {
    periodStart = budgetStartDate
    periodEnd = today
  } else {
    const [y, m] = selectedPeriod.split('-').map(Number)
    const range = monthRange(y, m)
    // Clip to the tracking start date for the first (partial) month.
    periodStart = budgetStartDate && budgetStartDate > range.start ? budgetStartDate : range.start
    periodEnd = range.end > today ? today : range.end
  }

  const { budgets } = useBudgets(isSoFar ? currentMonth : selectedPeriod)
  const budgetByCategory = isSoFar ? {} : Object.fromEntries(budgets.map((b) => [b.category_id, b]))

  const periodExpenses = expenses.filter(
    (e) => !e.trip_id && periodStart && e.date >= periodStart && e.date <= periodEnd
  )
  const pendingCount = periodExpenses.filter((e) => e.pending).length
  const totalSpent = periodExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const todaySpent = periodExpenses
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const dailyIncome = household?.daily_income != null ? Number(household.daily_income) : null
  const daysElapsed = periodStart ? daysBetweenInclusive(periodStart, periodEnd) : null
  const incomeToDate = dailyIncome != null && daysElapsed != null ? dailyIncome * daysElapsed : null
  const savings = incomeToDate != null ? incomeToDate - totalSpent : null

  const byCategory = {}
  for (const e of periodExpenses) {
    const cat = e.categories
    const key = cat?.id ?? 'uncategorized'
    if (!byCategory[key]) {
      byCategory[key] = { category: cat, total: 0 }
    }
    byCategory[key].total += Number(e.amount)
  }
  const categoryRows = Object.values(byCategory).sort((a, b) => b.total - a.total)

  const tripExpenses = expenses.filter(
    (e) => e.trip_id && periodStart && e.date >= periodStart && e.date <= periodEnd
  )
  const byTrip = {}
  for (const e of tripExpenses) {
    if (!byTrip[e.trip_id]) {
      byTrip[e.trip_id] = { trip: trips.find((t) => t.id === e.trip_id), total: 0 }
    }
    byTrip[e.trip_id].total += Number(e.amount)
  }
  const tripRows = Object.values(byTrip).sort((a, b) => b.total - a.total)
  const tripsTotal = tripRows.reduce((sum, r) => sum + r.total, 0)
  const savingsAfterTrips = savings != null ? savings - tripsTotal : null

  const dailySpend = []
  if (periodStart) {
    const byDate = {}
    for (const e of expenses) {
      if (e.date < periodStart || e.date > periodEnd) continue
      byDate[e.date] = (byDate[e.date] ?? 0) + Number(e.amount)
    }
    const [sy, sm, sd] = periodStart.split('-').map(Number)
    const [ey, em, ed] = periodEnd.split('-').map(Number)
    let cursor = new Date(sy, sm - 1, sd)
    const end = new Date(ey, em - 1, ed)
    while (cursor <= end) {
      const iso = toISODate(cursor)
      dailySpend.push({ date: iso, total: byDate[iso] ?? 0 })
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
    }
  }
  const maxDaily = Math.max(1, ...dailySpend.map((d) => d.total))
  const avgDaily = dailySpend.length
    ? dailySpend.reduce((sum, d) => sum + d.total, 0) / dailySpend.length
    : 0

  const byPerson = { anh: 0, em: 0, us: 0 }
  for (const e of periodExpenses) {
    const key = e.for_whom in byPerson ? e.for_whom : 'us'
    byPerson[key] += Number(e.amount)
  }

  const paidBy = { anh: 0, em: 0 }
  for (const e of periodExpenses) {
    if (e.em_chi) paidBy.em += Number(e.amount)
    else paidBy.anh += Number(e.amount)
  }

  return (
    <Layout
      title={
        <select
          value={selectedPeriod}
          onChange={(e) => setSelectedPeriod(e.target.value)}
          aria-label="Time period"
          className="font-heading -ml-1 rounded-lg border-none bg-transparent py-0.5 pl-1 pr-1 text-lg font-bold text-stone-800 outline-none"
        >
          {periodOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      }
    >
      <section className="mb-6 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
        <p className="text-sm font-semibold text-stone-400">Total spent</p>
        <p className="mt-1 text-3xl font-bold text-stone-800">{formatCurrency(totalSpent)}</p>
        {pendingCount > 0 && (
          <p className="mt-0.5 text-xs font-semibold text-amber-500">
            Includes {pendingCount} not-yet-synced expense{pendingCount > 1 ? 's' : ''}
          </p>
        )}
        {incomeToDate != null && (
          <div className="mt-3">
            <BudgetBar spent={totalSpent} limit={incomeToDate} />
            <p className="mt-1 text-xs font-semibold text-stone-400">
              {formatCurrency(totalSpent)} of {formatCurrency(incomeToDate)} earned ({selectedLabel}, {daysElapsed}{' '}
              days × {formatCurrency(dailyIncome)})
            </p>
          </div>
        )}
        {savings != null && (
          <div className="mt-3 flex items-center justify-between border-t border-pink-50 pt-3">
            <span className="text-sm font-semibold text-stone-400">Savings</span>
            <span className={`text-lg font-bold ${savings >= 0 ? 'text-stone-800' : 'text-rose-500'}`}>
              {formatCurrency(savings)}
            </span>
          </div>
        )}
        {savingsAfterTrips != null && tripsTotal > 0 && (
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-stone-400">
              Savings after trips (−{formatCurrency(tripsTotal)})
            </span>
            <span
              className={`text-sm font-bold ${savingsAfterTrips >= 0 ? 'text-stone-600' : 'text-rose-500'}`}
            >
              {formatCurrency(savingsAfterTrips)}
            </span>
          </div>
        )}
        {showsToday && (
          <div className="mt-3 flex items-center justify-between border-t border-pink-50 pt-3">
            <span className="text-sm font-semibold text-stone-400">Today</span>
            <span className="text-lg font-bold text-pink-500">{formatCurrency(todaySpent)}</span>
          </div>
        )}
      </section>

      {dailySpend.length > 0 && (
        <section className="mb-6 rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500">Per day ({selectedLabel})</h2>
            <span className="text-xs font-semibold text-stone-400">avg {formatCurrency(avgDaily)}/day</span>
          </div>
          <div className="-mx-1 flex items-end gap-1 overflow-x-auto px-1 pb-1">
            {dailySpend.map((d) => {
              const isToday = d.date === today
              const heightPct = Math.max(4, Math.round((d.total / maxDaily) * 100))
              const dayNum = Number(d.date.slice(8, 10))
              return (
                <div
                  key={d.date}
                  className="flex w-4 flex-shrink-0 flex-col items-center gap-1"
                  title={`${d.date}: ${formatCurrency(d.total)}`}
                >
                  <div className="flex h-16 w-full items-end">
                    <div
                      className={`w-full rounded-t-sm transition-all ${
                        isToday ? 'bg-pink-500' : d.total > 0 ? 'bg-pink-300' : 'bg-pink-50'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className={`text-[9px] font-semibold ${isToday ? 'text-pink-600' : 'text-stone-300'}`}>
                    {dayNum}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {tripRows.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-stone-500">Trips ({selectedLabel})</h2>
          <ul className="space-y-2">
            {tripRows.map(({ trip, total }) => (
              <li key={trip?.id ?? 'unknown-trip'}>
                <Link
                  to={trip ? `/trips/${trip.id}` : '/trips'}
                  className="block rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-stone-700">
                      {trip?.icon || '✈️'} {trip?.name ?? 'Trip'}
                    </span>
                    <span className="font-bold text-stone-800">{formatCurrency(total)}</span>
                  </div>
                  {trip?.budget && (
                    <div className="mt-2">
                      <BudgetBar spent={total} limit={Number(trip.budget)} />
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-stone-400">
            Not counted toward Total spent / Savings above — trips track against their own budget.
          </p>
        </section>
      )}

      <Link
        to="/add"
        className="mb-6 block w-full rounded-full bg-pink-500 py-3 text-center font-bold text-white shadow-md shadow-pink-200"
      >
        + Add expense
      </Link>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">By person</h2>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(FOR_LABELS).map(([key, { label, icon }]) => (
            <div
              key={key}
              className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50"
            >
              <div className="flex items-center gap-1.5">
                <img src={icon} alt="" className="h-5 w-5" />
                <p className="text-xs font-semibold text-stone-400">{label}</p>
              </div>
              <p className="mt-1 text-sm font-bold text-stone-800">{formatCurrency(byPerson[key])}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Paid by</h2>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
            <div className="flex items-center gap-1.5">
              <img src="/icons/nav/anh.png" alt="" className="h-5 w-5" />
              <p className="text-xs font-semibold text-stone-400">Anh chi</p>
            </div>
            <p className="mt-1 text-sm font-bold text-stone-800">{formatCurrency(paidBy.anh)}</p>
          </div>
          <div className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
            <div className="flex items-center gap-1.5">
              <img src="/icons/nav/em.png" alt="" className="h-5 w-5" />
              <p className="text-xs font-semibold text-stone-400">Em chi</p>
            </div>
            <p className="mt-1 text-sm font-bold text-stone-800">{formatCurrency(paidBy.em)}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-500">By category</h2>
        {loading && <p className="text-sm text-stone-400">Loading…</p>}
        {!loading && categoryRows.length === 0 && (
          <p className="text-sm text-stone-400">No expenses yet.</p>
        )}
        <ul className="space-y-2">
          {categoryRows.map(({ category, total }) => {
            const budget = category && budgetByCategory[category.id]
            return (
              <li
                key={category?.id ?? 'uncategorized'}
                className="rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-stone-700">
                    <span>{categoryIcon(category)}</span>
                    {category?.name ?? 'Uncategorized'}
                  </span>
                  <span className="font-bold text-stone-800">{formatCurrency(total)}</span>
                </div>
                {budget && (
                  <div className="mt-2">
                    <BudgetBar spent={total} limit={Number(budget.limit_amount)} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </Layout>
  )
}

function BudgetBar({ spent, limit }) {
  if (!limit) return null
  const pct = Math.min((spent / limit) * 100, 100)
  const over = spent > limit
  const near = !over && pct >= 80

  const barColor = over ? 'bg-rose-500' : near ? 'bg-amber-400' : 'bg-pink-400'

  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-pink-50">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {over && <p className="mt-1 text-xs font-bold text-rose-500">Over budget</p>}
      {near && <p className="mt-1 text-xs font-bold text-amber-500">Approaching limit</p>}
    </div>
  )
}
