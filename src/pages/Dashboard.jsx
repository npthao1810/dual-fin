import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useHousehold } from '../context/HouseholdContext'
import { useExpensesWithPending } from '../hooks/useExpensesWithPending'
import { useSessionState } from '../hooks/useSessionState'
import { daysBetweenInclusive, firstOfMonth, formatCurrency, monthRange, toISODate } from '../lib/format'
import { categoryIcon } from '../lib/categoryIcons'

function monthLabel(monthStart) {
  const [year, month] = monthStart.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

function buildMonthOptions(startDate) {
  const first = startDate ? firstOfMonth(new Date(`${startDate}T00:00:00`)) : firstOfMonth()
  const [startYear, startMonth] = first.split('-').map(Number)
  const now = new Date()
  const sinceLabel = startDate
    ? `Since ${new Date(`${startDate}T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
    : 'Since tracking started'
  const options = [{ value: 'so_far', label: sinceLabel }]
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  while (year > startYear || (year === startYear && month >= startMonth)) {
    const value = `${year}-${String(month).padStart(2, '0')}-01`
    options.push({ value, label: monthLabel(value) })
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return options
}

function typeFor(expense) {
  return expense.expense_type ?? (expense.trip_id ? 'trip' : 'daily')
}

/** Shared "how much of the limit is used" numbers. The bar width is capped at 100%, the label is not. */
function usage(spent, limit) {
  const remaining = limit - spent
  const rawPercent = limit > 0 ? Math.round((spent / limit) * 100) : 0
  return {
    remaining,
    percent: rawPercent,
    barWidth: Math.min(100, rawPercent),
    over: limit > 0 && remaining < 0,
    near: limit > 0 && remaining >= 0 && rawPercent >= 80,
  }
}

function BudgetCard({ icon, title, spent, limit, tone }) {
  const { remaining, percent, barWidth, over, near } = usage(spent, limit)
  const barColor = over ? 'bg-rose-500' : near ? 'bg-amber-400' : tone === 'trip' ? 'bg-orange-400' : 'bg-pink-500'
  const cardColor = over
    ? 'border-rose-200 bg-rose-50'
    : tone === 'trip'
      ? 'border-orange-100 bg-orange-50/60'
      : 'border-pink-100 bg-pink-50/60'
  return (
    <div className={`rounded-2xl border p-3 ${cardColor}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-stone-700">{icon} {title}</p>
        <p className={`text-sm font-bold ${over ? 'text-rose-600' : 'text-stone-800'}`}>{formatCurrency(spent)}</p>
      </div>
      {limit > 0 && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barWidth}%` }} />
        </div>
      )}
      <div className="mt-1 flex items-center justify-between text-[11px] font-semibold text-stone-400">
        <span>{limit > 0 ? `${percent}% of ${formatCurrency(limit)}` : 'Set a daily limit in Settings'}</span>
        {over ? (
          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {formatCurrency(Math.abs(remaining))} over
          </span>
        ) : (
          limit > 0 && <span className={near ? 'text-amber-600' : ''}>{formatCurrency(remaining)} left</span>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { household } = useHousehold()
  const today = toISODate(new Date())
  const monthOptions = buildMonthOptions(household?.budget_start_date)
  // Open on the current month (not the cumulative "Since …" view), and keep
  // whatever was picked while moving between tabs. A stored month that is no
  // longer in the list (e.g. before the start date) falls back to this month.
  const currentMonth = firstOfMonth()
  const [storedPeriod, setSelectedPeriod] = useSessionState('dualfin.dashboard.period', currentMonth)
  const selectedPeriod = monthOptions.some((option) => option.value === storedPeriod) ? storedPeriod : currentMonth
  const [storedTab, setActiveTab] = useSessionState('dualfin.dashboard.tab', 'overall')
  const activeTab = ['overall', 'daily', 'trip'].includes(storedTab) ? storedTab : 'overall'
  const [selectedDay, setSelectedDay] = useState(null)
  const isSoFar = selectedPeriod === 'so_far'
  const [year, month] = isSoFar ? [new Date().getFullYear(), new Date().getMonth() + 1] : selectedPeriod.split('-').map(Number)
  const range = monthRange(year, month)
  const budgetStartDate = household?.budget_start_date ?? null
  // A single month is clipped to the tracking start date, so the first
  // (partial) month only accrues limits from the day tracking began.
  const periodStart = isSoFar
    ? budgetStartDate
    : budgetStartDate && budgetStartDate > range.start
      ? budgetStartDate
      : range.start
  const periodEnd = isSoFar || range.end > today ? today : range.end
  const { expenses, loading } = useExpensesWithPending({ startDate: periodStart, endDate: periodEnd })

  // Limits are per-day rates: a period's budget is rate × days elapsed in it.
  const daysElapsed = periodStart && periodStart <= periodEnd ? daysBetweenInclusive(periodStart, periodEnd) : 0
  const dailyRate = Number(household?.daily_household_limit) || 0
  const tripRate = Number(household?.daily_trip_limit) || 0

  const dailyExpenses = expenses.filter((expense) => typeFor(expense) === 'daily')
  const tripExpenses = expenses.filter((expense) => typeFor(expense) === 'trip')
  const dailySpent = dailyExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const tripSpent = tripExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)
  const totalSpent = dailySpent + tripSpent
  const dailyLimit = dailyRate * daysElapsed
  const tripLimit = tripRate * daysElapsed
  const totalLimit = dailyLimit + tripLimit
  const totalRemaining = totalLimit - totalSpent
  const total = usage(totalSpent, totalLimit)
  const pendingCount = expenses.filter((expense) => expense.pending).length

  const visibleExpenses = activeTab === 'overall'
    ? expenses
    : expenses.filter((expense) => typeFor(expense) === activeTab)
  const focusedSpent = activeTab === 'daily' ? dailySpent : tripSpent
  const focusedLimit = activeTab === 'daily' ? dailyLimit : tripLimit
  const focusedRemaining = focusedLimit - focusedSpent
  const focused = usage(focusedSpent, focusedLimit)
  const focusedLabel = activeTab === 'daily' ? 'Daily' : 'Trip'
  const visiblePendingCount = visibleExpenses.filter((expense) => expense.pending).length

  const categoryRows = useMemo(() => {
    const grouped = {}
    for (const expense of visibleExpenses) {
      const key = expense.categories?.id ?? 'uncategorized'
      if (!grouped[key]) grouped[key] = { category: expense.categories, total: 0 }
      grouped[key].total += Number(expense.amount)
    }
    return Object.values(grouped).sort((a, b) => b.total - a.total)
  }, [visibleExpenses])

  const dailySpend = useMemo(() => {
    const grouped = {}
    for (const expense of visibleExpenses) grouped[expense.date] = (grouped[expense.date] ?? 0) + Number(expense.amount)
    return Object.entries(grouped)
      .map(([date, total]) => ({ date, total }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [visibleExpenses])
  const maxDaily = Math.max(1, ...dailySpend.map((item) => item.total))
  const selectedDaySpend = dailySpend.find((item) => item.date === selectedDay)

  const paidBy = visibleExpenses.reduce(
    (totals, expense) => {
      totals[expense.em_chi ? 'em' : 'anh'] += Number(expense.amount)
      return totals
    },
    { anh: 0, em: 0 }
  )

  return (
    <Layout
      title={
        <select
          value={selectedPeriod}
          onChange={(event) => setSelectedPeriod(event.target.value)}
          aria-label="Time period"
          className="font-heading -ml-1 rounded-lg border-none bg-transparent py-0.5 pl-1 text-lg font-bold text-stone-800 outline-none"
        >
          {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      }
    >
      <div role="tablist" aria-label="Expense view" className="mb-5 grid grid-cols-3 rounded-2xl bg-white p-1 shadow-sm shadow-pink-100">
        {[
          { value: 'overall', label: 'Overall', icon: '✨' },
          { value: 'daily', label: 'Daily', icon: '🏠' },
          { value: 'trip', label: 'Trip', icon: '✈️' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.value}
            onClick={() => {
              setActiveTab(tab.value)
              setSelectedDay(null)
            }}
            className={`rounded-xl px-2 py-2 text-sm font-bold transition ${
              activeTab === tab.value ? 'bg-stone-800 text-white shadow-sm' : 'text-stone-400'
            }`}
          >
            <span aria-hidden="true">{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overall' ? (
        <>
          <section className="mb-5 rounded-3xl bg-gradient-to-br from-stone-800 to-stone-700 p-5 text-white shadow-lg shadow-stone-200">
            <p className="text-sm font-semibold text-stone-300">Total expense</p>
            <p className="mt-1 text-3xl font-bold">{formatCurrency(totalSpent)}</p>
            {pendingCount > 0 && <p className="mt-1 text-xs font-semibold text-amber-300">Includes {pendingCount} pending sync</p>}
            {totalLimit > 0 ? (
              <>
                <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
                  <div className={`h-full rounded-full ${total.over ? 'bg-rose-400' : total.near ? 'bg-amber-300' : 'bg-pink-400'}`} style={{ width: `${total.barWidth}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs font-semibold text-stone-300">
                  <span>{total.percent}% of {formatCurrency(totalLimit)}</span>
                  <span>{daysElapsed} days × {formatCurrency(dailyRate + tripRate)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-sm font-semibold text-stone-300">{total.over ? 'Overspent' : 'Savings'}</span>
                  <span className={`text-lg font-bold ${total.over ? 'text-rose-300' : 'text-white'}`}>
                    {total.over ? `−${formatCurrency(Math.abs(totalRemaining))}` : formatCurrency(totalRemaining)}
                  </span>
                </div>
              </>
            ) : (
              <Link to="/settings" className="mt-3 inline-block text-xs font-bold text-pink-300">Set your daily limits →</Link>
            )}
          </section>

          <section className="mb-5 grid gap-3">
            <BudgetCard icon="🏠" title="Daily" spent={dailySpent} limit={dailyLimit} tone="daily" />
            <BudgetCard icon="✈️" title="Trip" spent={tripSpent} limit={tripLimit} tone="trip" />
          </section>
        </>
      ) : (
        <section className={`mb-5 rounded-3xl p-5 shadow-lg ${focused.over ? 'bg-gradient-to-br from-rose-700 to-rose-600 text-white shadow-rose-100' : activeTab === 'trip' ? 'bg-gradient-to-br from-orange-500 to-orange-400 text-white shadow-orange-100' : 'bg-gradient-to-br from-pink-600 to-pink-500 text-white shadow-pink-100'}`}>
          <p className="text-sm font-semibold text-white/75">{focusedLabel} expense</p>
          <p className="mt-1 text-3xl font-bold">{formatCurrency(focusedSpent)}</p>
          {visiblePendingCount > 0 && <p className="mt-1 text-xs font-semibold text-amber-100">Includes {visiblePendingCount} pending sync</p>}
          {focusedLimit > 0 ? (
            <>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/25">
                <div className={`h-full rounded-full ${focused.near ? 'bg-amber-200' : 'bg-white'}`} style={{ width: `${focused.barWidth}%` }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs font-semibold text-white/80">
                <span>{focused.percent}% of {formatCurrency(focusedLimit)}</span>
                {focused.over ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-rose-600">
                    {formatCurrency(Math.abs(focusedRemaining))} over
                  </span>
                ) : (
                  <span className="text-white">{formatCurrency(focusedRemaining)} remaining</span>
                )}
              </div>
            </>
          ) : (
            <Link to="/settings" className="mt-3 inline-block text-xs font-bold text-white">Set a daily {focusedLabel.toLowerCase()} limit →</Link>
          )}
        </section>
      )}

      {dailySpend.length > 0 && (
        <section className="mb-5 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-500">{activeTab === 'overall' ? 'Total' : focusedLabel} spending by day</h2>
            <span className="text-xs font-bold text-stone-400">
              {selectedDaySpend ? `${selectedDaySpend.date.slice(5)} · ${formatCurrency(selectedDaySpend.total)}` : 'Tap a bar'}
            </span>
          </div>
          <div className="flex h-28 items-end gap-1 overflow-x-auto pb-1">
            {dailySpend.map((item) => (
              <button
                key={item.date}
                type="button"
                onClick={() => setSelectedDay(item.date === selectedDay ? null : item.date)}
                aria-label={`${item.date}: ${formatCurrency(item.total)}`}
                className={`min-w-3 flex-1 rounded-t-md ${item.date === selectedDay ? 'bg-stone-700' : 'bg-pink-300'}`}
                style={{ height: `${Math.max(8, (item.total / maxDaily) * 100)}%` }}
              />
            ))}
          </div>
        </section>
      )}

      <section className="mb-5">
        <h2 className="mb-3 text-sm font-semibold text-stone-500">{activeTab === 'overall' ? 'All expenses' : focusedLabel} by category</h2>
        <ul className="space-y-2">
          {categoryRows.map(({ category, total }) => (
            <li key={category?.id ?? 'uncategorized'} className="flex items-center justify-between rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
              <span className="flex items-center gap-2 font-semibold text-stone-700">
                <span>{categoryIcon(category)}</span>{category?.name ?? 'Uncategorized'}
              </span>
              <span className="font-bold text-stone-800">{formatCurrency(total)}</span>
            </li>
          ))}
          {!loading && categoryRows.length === 0 && <p className="text-sm text-stone-400">No expenses for this period.</p>}
        </ul>
      </section>

      <section className="mb-5 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
        <h2 className="mb-3 text-sm font-semibold text-stone-500">Paid by · {activeTab === 'overall' ? 'total expenses' : `${focusedLabel.toLowerCase()} expenses`}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-pink-50 p-3 text-center">
            <p className="text-xs font-semibold text-stone-400">Anh chi</p>
            <p className="mt-1 font-bold text-stone-800">{formatCurrency(paidBy.anh)}</p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-3 text-center">
            <p className="text-xs font-semibold text-stone-400">Em chi</p>
            <p className="mt-1 font-bold text-stone-800">{formatCurrency(paidBy.em)}</p>
          </div>
        </div>
      </section>

      <Link to="/history" className="block text-center text-sm font-bold text-pink-500">View all transactions →</Link>
    </Layout>
  )
}
