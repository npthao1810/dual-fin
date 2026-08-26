import { useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ActivityTabs from '../components/ActivityTabs'
import { useExpensesWithPending } from '../hooks/useExpensesWithPending'
import { formatCurrency } from '../lib/format'
import { categoryIcon } from '../lib/categoryIcons'
import { removeFromQueue } from '../lib/offlineQueue'

const FOR_ICONS = {
  anh: '/icons/nav/anh.png',
  em: '/icons/nav/em.png',
  us: '/icons/nav/us.png',
}

export default function History() {
  const { expenses, loading } = useExpensesWithPending()

  const [search, setSearch] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')

  const activeFilterCount =
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (priceMin ? 1 : 0) + (priceMax ? 1 : 0)

  function clearFilters() {
    setDateFrom('')
    setDateTo('')
    setPriceMin('')
    setPriceMax('')
  }

  const filtered = expenses.filter((e) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchesNote = e.note?.toLowerCase().includes(q)
      const matchesCategory = e.categories?.name?.toLowerCase().includes(q)
      if (!matchesNote && !matchesCategory) return false
    }
    if (dateFrom && e.date < dateFrom) return false
    if (dateTo && e.date > dateTo) return false
    if (priceMin && Number(e.amount) < Number(priceMin)) return false
    if (priceMax && Number(e.amount) > Number(priceMax)) return false
    return true
  })

  const groups = []
  let currentDate = null
  for (const e of filtered) {
    if (e.date !== currentDate) {
      currentDate = e.date
      groups.push({ date: e.date, items: [] })
    }
    groups[groups.length - 1].items.push(e)
  }

  return (
    <Layout title="Activity">
      <ActivityTabs />

      <div className="mb-3 flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search expenses…"
          className="flex-1 rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold ${
            activeFilterCount > 0
              ? 'border-pink-500 bg-pink-500 text-white'
              : 'border-pink-200 bg-white text-stone-500'
          }`}
        >
          Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
      </div>

      {filtersOpen && (
        <div className="mb-4 space-y-3 rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
          <div>
            <p className="mb-1 text-xs font-semibold text-stone-400">Date range</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex-1 rounded-xl border border-pink-200 bg-white px-2 py-1.5 text-sm text-stone-700"
              />
              <span className="text-xs text-stone-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex-1 rounded-xl border border-pink-200 bg-white px-2 py-1.5 text-sm text-stone-700"
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-stone-400">Amount (₫)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="Min"
                className="flex-1 rounded-xl border border-pink-200 bg-white px-2 py-1.5 text-sm text-stone-700"
              />
              <span className="text-xs text-stone-400">to</span>
              <input
                type="number"
                inputMode="decimal"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="Max"
                className="flex-1 rounded-xl border border-pink-200 bg-white px-2 py-1.5 text-sm text-stone-700"
              />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-pink-500"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {loading && <p className="text-sm text-stone-400">Loading…</p>}
      {!loading && expenses.length === 0 && (
        <p className="text-sm text-stone-400">No expenses recorded yet.</p>
      )}
      {!loading && expenses.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-stone-400">No expenses match your search/filters.</p>
      )}
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.date}>
            <h2 className="mb-2 text-sm font-semibold text-stone-500">{group.date}</h2>
            <ul className="space-y-2">
              {group.items.map((e) => {
                const content = (
                  <>
                    <div>
                      <p className="font-semibold text-stone-700">
                        {categoryIcon(e.categories)} {e.note}
                      </p>
                      <p className="flex items-center gap-1 text-xs font-semibold text-stone-400">
                        {e.categories?.name ?? 'Uncategorized'} ·
                        {FOR_ICONS[e.for_whom] && (
                          <img src={FOR_ICONS[e.for_whom]} alt="" className="h-4 w-4" />
                        )}
                        {e.for_whom} · {e.em_chi ? 'Em chi' : 'Anh chi'}
                      </p>
                      {e.pending && e.status === 'pending' && (
                        <p className="mt-1 text-xs font-bold text-amber-500">🔄 Pending sync</p>
                      )}
                      {e.pending && e.status === 'error' && (
                        <p className="mt-1 text-xs font-bold text-rose-500">⚠️ Couldn't sync: {e.errorMessage}</p>
                      )}
                    </div>
                    <span className="font-bold text-stone-800">{formatCurrency(e.amount)}</span>
                  </>
                )

                if (e.pending) {
                  return (
                    <li
                      key={e.id}
                      className="flex items-center gap-2 rounded-2xl border border-dashed border-amber-200 bg-white/70 p-3 opacity-80"
                    >
                      <div className="flex flex-1 items-center justify-between">{content}</div>
                      {e.status === 'error' && (
                        <button
                          type="button"
                          onClick={() => removeFromQueue(e.id)}
                          className="text-xs font-bold text-stone-400"
                        >
                          Discard
                        </button>
                      )}
                    </li>
                  )
                }

                return (
                  <li key={e.id}>
                    <Link
                      to={`/edit/${e.id}`}
                      className="flex items-center justify-between rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50"
                    >
                      {content}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </Layout>
  )
}
