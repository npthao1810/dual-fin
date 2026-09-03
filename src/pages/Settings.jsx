import { useState } from 'react'
import Layout from '../components/Layout'
import { mutateOrQueue } from '../lib/mutate'
import { removeFromQueue } from '../lib/offlineQueue'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { useRowsWithPending } from '../hooks/useRowsWithPending'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useBudgets } from '../hooks/useBudgets'
import { firstOfMonth } from '../lib/format'
import { categoryIcon, fallbackEmojiFor, guessCategoryEmoji } from '../lib/categoryIcons'

const CATEGORY_COLORS = [
  '#fb7185', '#fb923c', '#f472b6', '#fdba74', '#f43f5e', '#fed7aa', '#ec4899', '#fbbf24',
]

function PendingBadge({ row }) {
  if (!row.pending) return null
  if (row.status === 'error') {
    return <p className="mt-1 text-xs font-bold text-rose-500">⚠️ Couldn't sync: {row.errorMessage}</p>
  }
  return <p className="mt-1 text-xs font-bold text-amber-500">🔄 Pending sync</p>
}

export default function Settings() {
  const { user, signOut } = useAuth()
  const { household, categories, refresh } = useHousehold()
  const month = firstOfMonth()
  const { budgets, upsertBudget, deleteBudget } = useBudgets(month)
  const queue = useOfflineQueue()
  const displayCategories = useRowsWithPending(
    categories,
    'categories',
    household ? { household_id: household.id } : null
  )

  const [newCategory, setNewCategory] = useState('')
  const [newIcon, setNewIcon] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [budgetDrafts, setBudgetDrafts] = useState({})
  const [budgetsExpanded, setBudgetsExpanded] = useState(false)
  const [dailyIncomeDraft, setDailyIncomeDraft] = useState(null)
  const [budgetStartDraft, setBudgetStartDraft] = useState(null)

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategory.trim() || !household) return
    setSavingCategory(true)
    const color = CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]
    const trimmedName = newCategory.trim()
    const icon =
      newIcon.trim() || guessCategoryEmoji(trimmedName) || fallbackEmojiFor(trimmedName + categories.length)
    await mutateOrQueue({
      table: 'categories',
      op: 'insert',
      payload: { id: crypto.randomUUID(), household_id: household.id, name: trimmedName, icon, color },
    })
    setNewCategory('')
    setNewIcon('')
    setSavingCategory(false)
    refresh()
  }

  async function handleDeleteCategory(id) {
    await mutateOrQueue({ table: 'categories', op: 'delete', match: { id } })
    refresh()
  }

  async function handleRenameCategory(categoryId, newName) {
    const trimmed = newName.trim()
    const current = displayCategories.find((c) => c.id === categoryId)
    if (!trimmed || !current || trimmed === current.name) return
    await mutateOrQueue({ table: 'categories', op: 'update', match: { id: categoryId }, payload: { name: trimmed } })
    refresh()
  }

  async function handleUpdateIcon(categoryId, newIcon) {
    const trimmed = newIcon.trim()
    const current = displayCategories.find((c) => c.id === categoryId)
    if (!trimmed || !current || trimmed === current.icon) return
    await mutateOrQueue({ table: 'categories', op: 'update', match: { id: categoryId }, payload: { icon: trimmed } })
    refresh()
  }

  // Budgets are keyed by (household, category, month) rather than a row id, so
  // their pending state is looked up from the queue directly instead of via useRowsWithPending.
  function pendingBudgetFor(categoryId) {
    return [...queue]
      .reverse()
      .find(
        (item) =>
          item.table === 'budgets' &&
          (item.payload?.category_id === categoryId || item.match?.category_id === categoryId) &&
          (item.payload?.month ?? item.match?.month) === month
      )
  }

  function budgetValueFor(categoryId) {
    if (budgetDrafts[categoryId] !== undefined) return budgetDrafts[categoryId]
    const pending = pendingBudgetFor(categoryId)
    if (pending) return pending.op === 'delete' ? '' : String(pending.payload.limit_amount)
    const existing = budgets.find((b) => b.category_id === categoryId)
    return existing ? String(existing.limit_amount) : ''
  }

  async function handleBudgetBlur(categoryId) {
    const value = budgetDrafts[categoryId]
    if (value === undefined) return
    if (value === '') {
      await deleteBudget(categoryId)
    } else {
      await upsertBudget(categoryId, Number(value))
    }
    setBudgetDrafts((prev) => {
      const next = { ...prev }
      delete next[categoryId]
      return next
    })
  }

  // Household settings are single fields on one row — look up any queued
  // update touching that field the same way budgets do.
  function pendingHouseholdFieldUpdate(field) {
    if (!household) return null
    return [...queue]
      .reverse()
      .find(
        (item) =>
          item.table === 'households' &&
          item.op === 'update' &&
          item.match?.id === household.id &&
          item.payload &&
          field in item.payload
      )
  }

  const pendingDailyIncome = pendingHouseholdFieldUpdate('daily_income')
  const pendingBudgetStart = pendingHouseholdFieldUpdate('budget_start_date')

  const dailyIncomeValue =
    dailyIncomeDraft ??
    (pendingDailyIncome
      ? String(pendingDailyIncome.payload.daily_income)
      : household?.daily_income != null
        ? String(household.daily_income)
        : '')

  async function handleDailyIncomeBlur() {
    if (dailyIncomeDraft === null || dailyIncomeDraft === '' || !household) return
    await mutateOrQueue({
      table: 'households',
      op: 'update',
      match: { id: household.id },
      payload: { daily_income: Number(dailyIncomeDraft) },
    })
    setDailyIncomeDraft(null)
    refresh()
  }

  const budgetStartValue =
    budgetStartDraft ?? pendingBudgetStart?.payload.budget_start_date ?? household?.budget_start_date ?? ''

  async function handleBudgetStartChange(value) {
    setBudgetStartDraft(value)
    if (!value || !household) return
    await mutateOrQueue({
      table: 'households',
      op: 'update',
      match: { id: household.id },
      payload: { budget_start_date: value },
    })
    setBudgetStartDraft(null)
    refresh()
  }

  return (
    <Layout title="Settings">
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Categories</h2>
        <form onSubmit={handleAddCategory} className="mb-3 flex gap-2">
          <input
            type="text"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="🍔"
            maxLength={2}
            className="w-14 rounded-xl border border-pink-200 bg-white px-2 py-2 text-center text-sm"
          />
          <input
            type="text"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category"
            className="flex-1 rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300"
          />
          <button
            type="submit"
            disabled={savingCategory}
            className="rounded-xl bg-pink-500 px-4 py-2 text-sm font-bold text-white shadow-sm shadow-pink-200"
          >
            Add
          </button>
        </form>
        <ul className="space-y-2">
          {displayCategories.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50"
            >
              <span className="flex-1">
                <span className="flex items-center gap-2 font-semibold text-stone-700">
                  <input
                    type="text"
                    defaultValue={c.icon ?? guessCategoryEmoji(c.name) ?? fallbackEmojiFor(c.id ?? c.name)}
                    maxLength={2}
                    onBlur={(e) => handleUpdateIcon(c.id, e.target.value)}
                    className="w-8 shrink-0 border-none bg-transparent p-0 text-center outline-none focus:underline"
                  />
                  <input
                    type="text"
                    defaultValue={c.name}
                    onBlur={(e) => handleRenameCategory(c.id, e.target.value)}
                    className="min-w-0 flex-1 border-none bg-transparent p-0 font-semibold text-stone-700 outline-none focus:underline"
                  />
                </span>
                <PendingBadge row={c} />
              </span>
              {c.pending && c.status === 'error' ? (
                <button
                  type="button"
                  onClick={() => removeFromQueue(c.queueId)}
                  className="text-sm font-semibold text-stone-400"
                >
                  Discard
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(c.id)}
                  className="text-sm font-semibold text-rose-500"
                >
                  Delete
                </button>
              )}
            </li>
          ))}
          {displayCategories.length === 0 && (
            <p className="text-sm text-stone-400">No categories yet — add one above.</p>
          )}
        </ul>
      </section>

      <section className="mb-6">
        <button
          type="button"
          onClick={() => setBudgetsExpanded((v) => !v)}
          className="flex w-full items-center justify-between rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50"
        >
          <span className="text-sm font-semibold text-stone-500">
            Monthly budgets — {new Date(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <span className="text-stone-400">{budgetsExpanded ? '▾' : '▸'}</span>
        </button>
        {budgetsExpanded && (
        <ul className="mt-2 space-y-2">
          {displayCategories.map((c) => {
            const pendingBudget = pendingBudgetFor(c.id)
            return (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-stone-700">
                  <span>{categoryIcon(c)}</span>
                  {c.name}
                </span>
                <div className="text-right">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={budgetValueFor(c.id)}
                      onChange={(e) =>
                        setBudgetDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      onBlur={() => handleBudgetBlur(c.id)}
                      className="w-28 rounded-xl border border-pink-200 bg-white px-2 py-1.5 text-right text-sm text-stone-700"
                    />
                    <span className="text-sm font-semibold text-stone-400">₫</span>
                  </div>
                  {pendingBudget?.status === 'pending' && (
                    <p className="mt-1 text-xs font-bold text-amber-500">🔄 Pending sync</p>
                  )}
                  {pendingBudget?.status === 'error' && (
                    <div className="mt-1 flex items-center justify-end gap-2">
                      <p className="text-xs font-bold text-rose-500">⚠️ Couldn't sync</p>
                      <button
                        type="button"
                        onClick={() => removeFromQueue(pendingBudget.id)}
                        className="text-xs font-bold text-stone-400"
                      >
                        Discard
                      </button>
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Household</h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
            <div>
              <p className="text-sm font-semibold text-stone-700">Daily income</p>
              <p className="text-xs text-stone-400">Used to calculate savings</p>
              {pendingDailyIncome?.status === 'pending' && (
                <p className="mt-1 text-xs font-bold text-amber-500">🔄 Pending sync</p>
              )}
              {pendingDailyIncome?.status === 'error' && (
                <p className="mt-1 text-xs font-bold text-rose-500">⚠️ Couldn't sync</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                inputMode="decimal"
                value={dailyIncomeValue}
                onChange={(e) => setDailyIncomeDraft(e.target.value)}
                onBlur={handleDailyIncomeBlur}
                className="w-28 rounded-xl border border-pink-200 bg-white px-2 py-1.5 text-right text-sm text-stone-700"
              />
              <span className="text-sm font-semibold text-stone-400">₫</span>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
            <div>
              <p className="text-sm font-semibold text-stone-700">Budget start date</p>
              <p className="text-xs text-stone-400">Savings count from this date, not the 1st</p>
              {pendingBudgetStart?.status === 'pending' && (
                <p className="mt-1 text-xs font-bold text-amber-500">🔄 Pending sync</p>
              )}
              {pendingBudgetStart?.status === 'error' && (
                <p className="mt-1 text-xs font-bold text-rose-500">⚠️ Couldn't sync</p>
              )}
            </div>
            <input
              type="date"
              value={budgetStartValue}
              onChange={(e) => handleBudgetStartChange(e.target.value)}
              className="rounded-xl border border-pink-200 bg-white px-2 py-1.5 text-sm text-stone-700"
            />
          </div>
        </div>
      </section>

      <section>
        <p className="mb-2 text-sm text-stone-400">Signed in as {user?.email}</p>
        <button
          type="button"
          onClick={() => signOut()}
          className="w-full rounded-full border border-pink-200 bg-white py-2.5 text-sm font-bold text-stone-500"
        >
          Sign out
        </button>
      </section>
    </Layout>
  )
}
