import { useEffect, useMemo, useState } from 'react'
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
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { useExpenses } from '../hooks/useExpenses'
import { currentMonthRange, formatCurrency, toISODate } from '../lib/format'

const FALLBACK_COLORS = ['#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#f87171']

export default function Charts() {
  const { household } = useHousehold()
  const { start, end } = currentMonthRange()
  const { expenses: monthExpenses } = useExpenses({ startDate: start, endDate: end })

  const thirtyDaysAgo = useMemo(
    () => toISODate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)),
    []
  )
  const { expenses: recentExpenses } = useExpenses({ startDate: thirtyDaysAgo })

  const [tripStats, setTripStats] = useState([])

  useEffect(() => {
    if (!household) return
    async function loadTrips() {
      const { data: trips } = await supabase
        .from('trips')
        .select('id, name, budget')
        .eq('household_id', household.id)

      const { data: tripExpenses } = await supabase
        .from('expenses')
        .select('trip_id, amount')
        .eq('household_id', household.id)
        .not('trip_id', 'is', null)

      const sums = {}
      for (const e of tripExpenses ?? []) {
        sums[e.trip_id] = (sums[e.trip_id] ?? 0) + Number(e.amount)
      }

      setTripStats(
        (trips ?? []).map((t) => ({
          name: t.name,
          budget: t.budget ? Number(t.budget) : 0,
          actual: sums[t.id] ?? 0,
        }))
      )
    }
    loadTrips()
  }, [household])

  const pieData = Object.values(
    monthExpenses
      .filter((e) => !e.trip_id)
      .reduce((acc, e) => {
        const key = e.categories?.name ?? 'Uncategorized'
        if (!acc[key]) acc[key] = { name: key, value: 0, color: e.categories?.color }
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

  return (
    <Layout title="Charts">
      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-slate-400">Spend by category (this month)</h2>
        {pieData.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label={(d) => d.name}>
                {pieData.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-medium text-slate-400">Spend over time (last 30 days)</h2>
        {dailyTotals.length === 0 ? (
          <p className="text-sm text-slate-500">No data yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyTotals}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
              <Line type="monotone" dataKey="total" stroke="#34d399" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-400">Trips: budget vs actual</h2>
        {tripStats.length === 0 ? (
          <p className="text-sm text-slate-500">No trips yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={tripStats}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="budget" fill="#334155" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </Layout>
  )
}
