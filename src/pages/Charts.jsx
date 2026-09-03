import { useMemo } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from 'recharts'
import Layout from '../components/Layout'
import { useHousehold } from '../context/HouseholdContext'
import { useExpensesWithPending } from '../hooks/useExpensesWithPending'
import { currentMonthRange, daysBetweenInclusive, formatCurrency, monthRange, toISODate } from '../lib/format'

const CATEGORY_CHART_COLORS = [
  '#ec4899', '#f97316', '#fbbf24', '#fb7185', '#e879f9', '#fdba74', '#f472b6', '#f87171', '#facc15', '#fda4af',
]

export default function Charts() {
  const { household } = useHousehold()
  // One fetch/cache/realtime subscription for every household expense ever
  // (the same "all expenses" cache History already warms) instead of three
  // separate overlapping range queries — each chart below just filters this
  // client-side.
  const { expenses: allExpenses } = useExpensesWithPending()

  const { start, end } = currentMonthRange()
  const monthExpenses = useMemo(
    () => allExpenses.filter((e) => e.date >= start && e.date <= end),
    [allExpenses, start, end]
  )

  const thirtyDaysAgo = useMemo(
    () => toISODate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
    []
  )
  const recentExpenses = useMemo(
    () => allExpenses.filter((e) => e.date >= thirtyDaysAgo),
    [allExpenses, thirtyDaysAgo]
  )

  const dailyIncome = household?.daily_income != null ? Number(household.daily_income) : null
  const budgetStartDate = household?.budget_start_date ?? null
  const today = toISODate(new Date())
  const budgetRangeExpenses = useMemo(
    () => (budgetStartDate ? allExpenses.filter((e) => e.date >= budgetStartDate && e.date <= today) : allExpenses),
    [allExpenses, budgetStartDate, today]
  )

  const pieData = Object.values(
    monthExpenses
      .filter((e) => !e.trip_id)
      .reduce((acc, e) => {
        const key = e.categories?.name ?? 'Uncategorized'
        if (!acc[key]) acc[key] = { name: key, value: 0 }
        acc[key].value += Number(e.amount)
        return acc
      }, {})
  )

  const dailyTotals = Object.values(
    recentExpenses.reduce((acc, e) => {
      if (!acc[e.date]) acc[e.date] = { date: e.date, total: 0 }
      acc[e.date].total += Number(e.amount)
      return acc
    }, {})
  ).sort((a, b) => a.date.localeCompare(b.date))

  const monthlyStats = []
  if (budgetStartDate && dailyIncome != null) {
    const [sy, sm] = budgetStartDate.split('-').map(Number)
    const [ey, em] = today.split('-').map(Number)
    let y = sy
    let m = sm
    while (y < ey || (y === ey && m <= em)) {
      const { start: monthStart, end: monthEnd } = monthRange(y, m)
      const rangeStart = monthStart < budgetStartDate ? budgetStartDate : monthStart
      const rangeEnd = monthEnd > today ? today : monthEnd
      if (rangeStart <= rangeEnd) {
        const days = daysBetweenInclusive(rangeStart, rangeEnd)
        const budget = dailyIncome * days
        const expense = budgetRangeExpenses
          .filter((e) => !e.trip_id && e.date >= rangeStart && e.date <= rangeEnd)
          .reduce((sum, e) => sum + Number(e.amount), 0)
        const label = new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
        monthlyStats.push({ label, budget, expense, savings: budget - expense })
      }
      m += 1
      if (m > 12) {
        m = 1
        y += 1
      }
    }
  }

  const tooltipStyle = {
    background: '#ffffff',
    border: '1px solid #fecdd3',
    borderRadius: 12,
    fontSize: 13,
  }

  return (
    <Layout title="Charts">
      <section className="mb-8 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Spend by category (this month)</h2>
        {pieData.length === 0 ? (
          <p className="text-sm text-stone-400">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label={(d) => d.name}>
                {pieData.map((entry, i) => (
                  <Cell key={entry.name} fill={CATEGORY_CHART_COLORS[i % CATEGORY_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Spend over time (last 30 days)</h2>
        {dailyTotals.length === 0 ? (
          <p className="text-sm text-stone-400">No data yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <div style={{ width: Math.max(dailyTotals.length * 28, 300), height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTotals} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#a8a29e' }}
                    tickFormatter={(d) => d.slice(5)}
                    interval={Math.max(0, Math.ceil(dailyTotals.length / 8) - 1)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} width={54} />
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="total" stroke="#fb7185" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {dailyTotals.length > 10 && (
          <p className="mt-1 text-center text-[10px] text-stone-300">← scroll for more →</p>
        )}
      </section>

      <section className="rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Budget vs spend vs savings</h2>
        {monthlyStats.length === 0 ? (
          <p className="text-sm text-stone-400">No data yet.</p>
        ) : (
          <div className="-mx-4 overflow-x-auto px-4">
            <div style={{ width: Math.max(monthlyStats.length * 90, 300), height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyStats} margin={{ left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#a8a29e' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#a8a29e' }} width={54} />
                  <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="expense" name="Spend" stackId="actual" barSize={48} fill="#fb7185" />
                  <Bar dataKey="savings" name="Savings" stackId="actual" barSize={48} fill="#fb923c" radius={[4, 4, 0, 0]}>
                    {monthlyStats.map((m) => (
                      <Cell key={m.label} fill={m.savings >= 0 ? '#fb923c' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {monthlyStats.length > 3 && (
          <p className="mt-1 text-center text-[10px] text-stone-300">← scroll for more →</p>
        )}
      </section>
    </Layout>
  )
}
