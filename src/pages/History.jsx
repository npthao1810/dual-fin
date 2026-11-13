import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ActivityTabs from '../components/ActivityTabs'
import { useExpensesWithPending } from '../hooks/useExpensesWithPending'
import { useTrips } from '../hooks/useTrips'
import { useHousehold } from '../context/HouseholdContext'
import { compactAmount, dayLevel, monthGrid } from '../lib/calendar'
import { formatCurrency, formatForeign, toISODate } from '../lib/format'
import { categoryIcon } from '../lib/categoryIcons'
import { removeFromQueue } from '../lib/offlineQueue'

const FOR_ICONS = {
  anh: '/icons/nav/anh.png',
  em: '/icons/nav/em.png',
  us: '/icons/nav/us.png',
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="h-5 w-5">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="10" y1="18" x2="14" y2="18" />
    </svg>
  )
}

function ExpenseRow({ e }) {
                const content = (
                  <>
                    <div>
                      <p className="font-semibold text-stone-700">
                        {categoryIcon(e.categories)} {e.note}
                      </p>
                      <p className="flex items-center gap-1 text-xs font-semibold text-stone-400">
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          (e.expense_type ?? (e.trip_id ? 'trip' : 'daily')) === 'trip'
                            ? 'bg-orange-100 text-orange-600'
                            : 'bg-pink-100 text-pink-600'
                        }`}>
                          {(e.expense_type ?? (e.trip_id ? 'trip' : 'daily')) === 'trip' ? 'Trip' : 'Daily'}
                        </span>
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
                    <div className="text-right">
                      <span className="font-bold text-stone-800">{formatCurrency(e.amount)}</span>
                      {e.currency && (
                        <p className="text-xs font-semibold text-stone-400">
                          {formatForeign(e.original_amount, e.currency)}
                        </p>
                      )}
                    </div>
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
                          onClick={() => removeFromQueue(e.queueId ?? e.id)}
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
}

export default function History() {
  const { expenses, loading } = useExpensesWithPending()
  const { household } = useHousehold()
  const { trips } = useTrips()

  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [expenseType, setExpenseType] = useState('all')

  const activeFilterCount =
    (priceMin ? 1 : 0) + (priceMax ? 1 : 0) + (expenseType !== 'all' ? 1 : 0)

  function clearFilters() {
    setPriceMin('')
    setPriceMax('')
    setExpenseType('all')
  }

  const filtered = expenses.filter((e) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchesNote = e.note?.toLowerCase().includes(q)
      const matchesCategory = e.categories?.name?.toLowerCase().includes(q)
      if (!matchesNote && !matchesCategory) return false
    }
    if (priceMin && Number(e.amount) < Number(priceMin)) return false
    if (priceMax && Number(e.amount) > Number(priceMax)) return false
    const type = e.expense_type ?? (e.trip_id ? 'trip' : 'daily')
    if (expenseType !== 'all' && type !== expenseType) return false
    return true
  })

  const typeOf = (e) => e.expense_type ?? (e.trip_id ? 'trip' : 'daily')

  // Per-day totals for the filtered expenses, split by budget.
  const byDay = new Map()
  for (const e of filtered) {
    const day = byDay.get(e.date) ?? { daily: 0, trip: 0, items: [] }
    day[typeOf(e) === 'trip' ? 'trip' : 'daily'] += Number(e.amount) || 0
    day.items.push(e)
    byDay.set(e.date, day)
  }

  const isSearching = search.trim() !== '' || activeFilterCount > 0
  const resultDays = [...byDay.entries()].sort(([x], [y]) => (x < y ? 1 : -1))
  const resultTotal = filtered.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)

  const today = toISODate(new Date())
  const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() + 1 }))
  const [pickedDay, setPickedDay] = useState(today)
  const grid = monthGrid(cursor.y, cursor.m)
  const monthPrefix = `${cursor.y}-${String(cursor.m).padStart(2, '0')}-`
  const monthLabel = new Date(cursor.y, cursor.m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  let monthDaily = 0
  let monthTrip = 0
  for (const [date, d] of byDay) {
    if (!date.startsWith(monthPrefix)) continue
    monthDaily += d.daily
    monthTrip += d.trip
  }

  // The selected day must belong to the month on screen.
  const selectedDay = pickedDay.startsWith(monthPrefix) ? pickedDay : null
  const selected = selectedDay ? byDay.get(selectedDay) : null

  function shiftMonth(delta) {
    const d = new Date(cursor.y, cursor.m - 1 + delta, 1)
    const next = { y: d.getFullYear(), m: d.getMonth() + 1 }
    setCursor(next)
    const prefix = `${next.y}-${String(next.m).padStart(2, '0')}-`
    // Current month opens on today; other months on their latest day with spending.
    const lastWithSpend = [...byDay.keys()].filter((d) => d.startsWith(prefix)).sort().pop()
    setPickedDay(today.startsWith(prefix) ? today : (lastWithSpend ?? `${prefix}01`))
  }

  function goToday() {
    const n = new Date()
    setCursor({ y: n.getFullYear(), m: n.getMonth() + 1 })
    setPickedDay(today)
  }

  const dailyRate = Number(household?.daily_household_limit) || 0
  const tripRate = Number(household?.daily_trip_limit) || 0
  const tripDays = useMemo(() => {
    const set = new Set()
    for (const t of trips) {
      if (!t.start_date || !t.end_date) continue
      const [sy, sm, sd] = t.start_date.split('-').map(Number)
      const [ey, em, ed] = t.end_date.split('-').map(Number)
      for (let d = new Date(sy, sm - 1, sd); d <= new Date(ey, em - 1, ed); d.setDate(d.getDate() + 1)) {
        set.add(toISODate(d))
      }
    }
    return set
  }, [trips])

  const LEVEL_CLASS = {
    none: 'bg-white text-stone-300',
    ok: 'bg-pink-50 text-stone-700',
    near: 'bg-amber-100 text-amber-800',
    over: 'bg-rose-100 text-rose-600',
  }

  return (
    <Layout title="Activity">
      <ActivityTabs />

      <div className="mb-3 flex gap-2">
        <button
          type="button"
          aria-label="Search"
          onClick={() => {
            // Closing the box also drops the text, so results never stay filtered by something you can't see.
            if (searchOpen) setSearch('')
            setSearchOpen((v) => !v)
          }}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
            searchOpen ? 'border-pink-500 bg-pink-500 text-white' : 'border-pink-200 bg-white text-stone-500'
          }`}
        >
          <SearchIcon />
        </button>
        <button
          type="button"
          aria-label="Filters"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
            filtersOpen || activeFilterCount > 0
              ? 'border-pink-500 bg-pink-500 text-white'
              : 'border-pink-200 bg-white text-stone-500'
          }`}
        >
          <FilterIcon />
          {activeFilterCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {searchOpen && (
        <input
          type="text"
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search expenses…"
          className="mb-4 w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300"
        />
      )}

      {filtersOpen && (
        <div className="mb-4 space-y-3 rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
          <div>
            <p className="mb-1 text-xs font-semibold text-stone-400">Budget</p>
            <div className="grid grid-cols-3 gap-2">
              {['all', 'daily', 'trip'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setExpenseType(type)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold capitalize ${
                    expenseType === type
                      ? 'border-pink-400 bg-pink-100 text-pink-600'
                      : 'border-stone-200 bg-white text-stone-400'
                  }`}
                >
                  {type}
                </button>
              ))}
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

      {!isSearching && (
        <>
      <div className="mb-3 rounded-3xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="h-9 w-9 rounded-full text-lg font-bold text-stone-500"
          >
            ‹
          </button>
          <button type="button" onClick={goToday} className="text-base font-bold text-stone-800">
            {monthLabel}
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="h-9 w-9 rounded-full text-lg font-bold text-stone-500"
          >
            ›
          </button>
        </div>
        <div className="mb-2 flex justify-center gap-4 text-xs font-semibold text-stone-500">
          <span>🏠 {formatCurrency(monthDaily)}</span>
          <span>✈️ {formatCurrency(monthTrip)}</span>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-stone-400">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {grid.map((date, i) => {
            if (!date) return <span key={i} />
            const day = byDay.get(date)
            const total = day ? day.daily + day.trip : 0
            const level = dayLevel(day?.daily ?? 0, dailyRate)
            const tripLevel = day?.trip && !day?.daily ? dayLevel(day.trip, tripRate) : 'none'
            const cellLevel = level !== 'none' ? level : tripLevel
            const isSel = date === selectedDay
            return (
              <button
                key={date}
                type="button"
                onClick={() => setPickedDay(date)}
                aria-label={date}
                aria-pressed={isSel}
                className={`relative flex h-12 flex-col items-center justify-center rounded-xl text-[11px] font-semibold leading-tight ${LEVEL_CLASS[cellLevel]} ${
                  isSel ? 'ring-2 ring-pink-500' : ''
                } ${date === today && !isSel ? 'ring-1 ring-stone-300' : ''}`}
              >
                <span className="text-xs font-bold">{Number(date.slice(8))}</span>
                <span className="text-[10px]">{total ? compactAmount(total) : ''}</span>
                {tripDays.has(date) && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-orange-400" />
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-2 flex flex-wrap items-center justify-center gap-x-3 text-[10px] font-semibold text-stone-400">
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-pink-200" />within limit</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-300" />near</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-300" />over</span>
          <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-400" />trip day</span>
        </p>
      </div>

        </>
      )}

      {loading && <p className="text-sm text-stone-400">Loading…</p>}
      {!loading && expenses.length === 0 && <p className="text-sm text-stone-400">No expenses recorded yet.</p>}
      {!loading && expenses.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-stone-400">No expenses match your search/filters.</p>
      )}
      {!isSearching && selectedDay && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-stone-500">
              {new Date(`${selectedDay}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short' })}
            </h2>
            {selected && (
              <span className="text-sm font-bold text-stone-700">{formatCurrency(selected.daily + selected.trip)}</span>
            )}
          </div>
          {!selected && !loading && <p className="text-sm text-stone-400">Nothing spent this day.</p>}
          {selected && (
            <ul className="space-y-2">
              {selected.items.map((e) => (
                <ExpenseRow key={e.id} e={e} />
              ))}
            </ul>
          )}
        </div>
      )}

      {isSearching && filtered.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-stone-500">
              {filtered.length} match{filtered.length === 1 ? '' : 'es'}
            </h2>
            <span className="text-sm font-bold text-stone-700">{formatCurrency(resultTotal)}</span>
          </div>
          <div className="space-y-4">
            {resultDays.map(([date, day]) => (
              <div key={date}>
                <h3 className="mb-2 text-xs font-semibold text-stone-400">
                  {new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </h3>
                <ul className="space-y-2">
                  {day.items.map((e) => (
                    <ExpenseRow key={e.id} e={e} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
