import { useState } from 'react'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useBudgets } from '../hooks/useBudgets'
import { firstOfMonth, formatCurrency } from '../lib/format'

const CATEGORY_COLORS = [
  '#34d399', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee', '#f87171',
]

export default function Settings() {
  const { user, signOut } = useAuth()
  const { household, categories, refresh } = useHousehold()
  const month = firstOfMonth()
  const { budgets, upsertBudget } = useBudgets(month)

  const [newCategory, setNewCategory] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [budgetDrafts, setBudgetDrafts] = useState({})

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategory.trim() || !household) return
    setSavingCategory(true)
    const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]
    await supabase.from('categories').insert({
      household_id: household.id,
      name: newCategory.trim(),
      icon: newIcon.trim() || null,
      color,
    })
    setNewCategory('')
    setNewIcon('')
    setSavingCategory(false)
    refresh()
  }

  async function handleDeleteCategory(id) {
    await supabase.from('categories').delete().eq('id', id)
    refresh()
  }

  function budgetValueFor(categoryId) {
    if (budgetDrafts[categoryId] !== undefined) return budgetDrafts[categoryId]
    const existing = budgets.find((b) => b.category_id === categoryId)
    return existing ? String(existing.limit_amount) : ''
  }

  async function handleBudgetBlur(categoryId) {
    const value = budgetDrafts[categoryId]
    if (value === undefined || value === '') return
    await upsertBudget(categoryId, Number(value))
  }

  return (
    <Layout title="Settings">
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-slate-400">Categories</h2>
        <form onSubmit={handleAddCategory} className="mb-3 flex gap-2">
          <input
            type="text"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="🍔"
            maxLength={2}
            className="w-14 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-center text-sm"
          />
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={savingCategory}
            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950"
          >
            Add
          </button>
        </form>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3"
            >
              <span className="flex items-center gap-2">
                <span>{c.icon}</span>
                {c.name}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteCategory(c.id)}
                className="text-sm text-rose-400"
              >
                Delete
              </button>
            </li>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-slate-500">No categories yet — add one above.</p>
          )}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-slate-400">
          Monthly budgets — {new Date(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </h2>
        <ul className="space-y-2">
          {categories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3"
            >
              <span className="flex items-center gap-2 text-sm">
                <span>{c.icon}</span>
                {c.name}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-slate-500">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={budgetValueFor(c.id)}
                  onChange={(e) =>
                    setBudgetDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                  }
                  onBlur={() => handleBudgetBlur(c.id)}
                  className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-right text-sm"
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-slate-400">Household</h2>
        <p className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm text-slate-400">
          Overall monthly budget: {household?.monthly_budget ? formatCurrency(household.monthly_budget) : 'Not set'}
          <br />
          <span className="text-xs">Set this in the Supabase table editor on the households row.</span>
        </p>
      </section>

      <section>
        <p className="mb-2 text-sm text-slate-500">Signed in as {user?.email}</p>
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full rounded-xl border border-slate-700 py-2.5 text-sm font-medium text-slate-300"
        >
          Sign out
        </button>
      </section>
    </Layout>
  )
}
