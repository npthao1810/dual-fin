import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { useHousehold } from '../context/HouseholdContext'
import { useExpensesWithPending } from '../hooks/useExpensesWithPending'
import { useBudgets } from '../hooks/useBudgets'
import { daysBetweenInclusive, firstOfMonth, formatCurrency, toISODate } from '../lib/format'
import { categoryIcon } from '../lib/categoryIcons'

const FOR_LABELS = {
  anh: { label: 'Anh', icon: '/icons/nav/anh.png' },
  em: { label: 'Em', icon: '/icons/nav/em.png' },
  us: { label: 'Us', icon: '/icons/nav/us.png' },
}

export default function Dashboard() {
  const { household } = useHousehold()
  const today = toISODate(new Date())
  const budgetStartDate = household?.budget_start_date ?? null
  const month = firstOfMonth()
  const { expenses, loading } = useExpensesWithPending({ startDate: budgetStartDate, endDate: today })
  const { budgets } = useBudgets(month)

  const monthlyExpenses = expenses.filter((e) => !e.trip_id)
  const pendingCount = monthlyExpenses.filter((e) => e.pending).length
  const totalSpent = monthlyExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const todaySpent = monthlyExpenses
    .filter((e) => e.date === today)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const dailyIncome = household?.daily_income != null ? Number(household.daily_income) : null
  const daysElapsed = budgetStartDate ? daysBetweenInclusive(budgetStartDate, today) : null
  const incomeToDate = dailyIncome != null && daysElapsed != null ? dailyIncome * daysElapsed : null
  const savings = incomeToDate != null ? incomeToDate - totalSpent : null

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

  const byPerson = { anh: 0, em: 0, us: 0 }
  for (const e of monthlyExpenses) {
    const key = e.for_whom in byPerson ? e.for_whom : 'us'
    byPerson[key] += Number(e.amount)
  }

  const paidBy = { anh: 0, em: 0 }
  for (const e of monthlyExpenses) {
    if (e.em_chi) paidBy.em += Number(e.amount)
    else paidBy.anh += Number(e.amount)
  }

  const startLabel = budgetStartDate
    ? (() => {
        const [y, m, d] = budgetStartDate.split('-').map(Number)
        return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
      })()
    : null

  return (
    <Layout title={startLabel ? `Since ${startLabel}` : 'Overview'}>
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
              {formatCurrency(totalSpent)} of {formatCurrency(incomeToDate)} earned so far ({daysElapsed} days
              × {formatCurrency(dailyIncome)})
            </p>
          </div>
        )}
        {savings != null && (
          <div className="mt-3 flex items-center justify-between border-t border-pink-50 pt-3">
            <span className="text-sm font-semibold text-stone-400">Savings so far</span>
            <span className={`text-lg font-bold ${savings >= 0 ? 'text-stone-800' : 'text-rose-500'}`}>
              {formatCurrency(savings)}
            </span>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-pink-50 pt-3">
          <span className="text-sm font-semibold text-stone-400">Today</span>
          <span className="text-lg font-bold text-stone-800">{formatCurrency(todaySpent)}</span>
        </div>
      </section>

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
