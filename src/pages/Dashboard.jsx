import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useHousehold } from '../context/HouseholdContext'
import { useExpenses } from '../hooks/useExpenses'
import { useBudgets } from '../hooks/useBudgets'
import { currentMonthRange, firstOfMonth, formatCurrency } from '../lib/format'

export default function Dashboard() {
  const { household } = useHousehold()
  const { start, end } = currentMonthRange()
  const month = firstOfMonth()
  const { expenses, loading } = useExpenses({ startDate: start, endDate: end })
  const { budgets } = useBudgets(month)

  const monthlyExpenses = expenses.filter((e) => !e.trip_id)
  const totalSpent = monthlyExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const monthlyBudget = household?.monthly_budget ? Number(household.monthly_budget) : null

  const byCategory = {}
  for (const e of monthlyExpenses) {
    const cat = e.categories
    const key = cat?.id ?? 'uncategorized'
    if (!byCategory[key]) {
      byCategory[key] = { category: cat, total: 0 }
    }
    byCategory[key].total += Number(e.amount)
  }
  const categoryRows = Object.values(byCategory).sort((a, b) => b.total - a.total)

  const budgetByCategory = Object.fromEntries(budgets.map((b) => [b.category_id, b]))

  return (
    <Layout title="This month">
      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Total spent</p>
        <p className="mt-1 text-3xl font-bold">{formatCurrency(totalSpent)}</p>
        {monthlyBudget != null && (
          <div className="mt-3">
            <BudgetBar spent={totalSpent} limit={monthlyBudget} />
            <p className="mt-1 text-xs text-slate-500">
              {formatCurrency(totalSpent)} of {formatCurrency(monthlyBudget)}
            </p>
          </div>
        )}
      </section>

      <Link
        to="/add"
        className="mb-6 block w-full rounded-xl bg-emerald-500 py-3 text-center font-semibold text-slate-950"
      >
        + Add expense
      </Link>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-400">By category</h2>
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        {!loading && categoryRows.length === 0 && (
          <p className="text-sm text-slate-500">No expenses yet this month.</p>
        )}
        <ul className="space-y-2">
          {categoryRows.map(({ category, total }) => {
            const budget = category && budgetByCategory[category.id]
            return (
              <li
                key={category?.id ?? 'uncategorized'}
                className="rounded-xl border border-slate-800 bg-slate-900 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium">
                    <span>{category?.icon ?? '💸'}</span>
                    {category?.name ?? 'Uncategorized'}
                  </span>
                  <span className="font-semibold">{formatCurrency(total)}</span>
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

  const barColor = over ? 'bg-rose-500' : near ? 'bg-amber-400' : 'bg-emerald-500'

  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      {over && <p className="mt-1 text-xs font-medium text-rose-400">Over budget</p>}
      {near && <p className="mt-1 text-xs font-medium text-amber-400">Approaching limit</p>}
    </div>
  )
}
