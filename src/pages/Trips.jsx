import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import ActivityTabs from '../components/ActivityTabs'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { currencySymbol, formatCurrency } from '../lib/format'
import { readCache, writeCache } from '../lib/localCache'

function cacheKeyFor(householdId) {
  return `trips:${householdId}`
}

export default function Trips() {
  const { household } = useHousehold()
  const cached = household ? readCache(cacheKeyFor(household.id)) : null
  const [trips, setTrips] = useState(() => cached?.trips ?? [])
  const [totals, setTotals] = useState(() => cached?.totals ?? {})
  const [showForm, setShowForm] = useState(false)
  const [icon, setIcon] = useState('')
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [currency, setCurrency] = useState('')
  const [exchangeRate, setExchangeRate] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadTrips() {
    if (!household) return
    const { data, error } = await supabase
      .from('trips')
      .select('*')
      .eq('household_id', household.id)
      .order('start_date', { ascending: false })
    // Keep showing whatever's cached/on screen if the request failed (e.g. offline).
    if (error) return
    setTrips(data ?? [])

    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .select('trip_id, amount')
      .eq('household_id', household.id)
      .not('trip_id', 'is', null)
    if (expenseError) {
      writeCache(cacheKeyFor(household.id), { trips: data ?? [], totals })
      return
    }

    const sums = {}
    for (const e of expenseData ?? []) {
      sums[e.trip_id] = (sums[e.trip_id] ?? 0) + Number(e.amount)
    }
    setTotals(sums)
    writeCache(cacheKeyFor(household.id), { trips: data ?? [], totals: sums })
  }

  useEffect(() => {
    loadTrips()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || !household) return
    setSaving(true)
    const trimmedCurrency = currency.trim().toUpperCase()
    await supabase.from('trips').insert({
      household_id: household.id,
      name: name.trim(),
      icon: icon.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      budget: budget || null,
      currency: trimmedCurrency || null,
      exchange_rate: trimmedCurrency && exchangeRate ? Number(exchangeRate) : null,
    })
    setIcon('')
    setName('')
    setStartDate('')
    setEndDate('')
    setBudget('')
    setCurrency('')
    setExchangeRate('')
    setShowForm(false)
    setSaving(false)
    loadTrips()
  }

  return (
    <Layout title="Activity">
      <ActivityTabs />
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        className="mb-4 w-full rounded-full bg-pink-500 py-2.5 text-sm font-bold text-white shadow-md shadow-pink-200"
      >
        {showForm ? 'Cancel' : '+ New trip'}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="✈️"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={2}
              className="w-14 shrink-0 rounded-xl border border-pink-200 bg-white px-2 py-2 text-center text-sm"
            />
            <input
              type="text"
              required
              placeholder="Trip name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-w-0 flex-1 rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-xl border border-pink-200 bg-white px-2 py-2 text-sm text-stone-700"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-xl border border-pink-200 bg-white px-2 py-2 text-sm text-stone-700"
            />
          </div>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Budget in ₫ (optional)"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Currency (e.g. KRW)"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={6}
              className="rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm uppercase text-stone-700 placeholder:text-stone-300 placeholder:normal-case"
            />
            <input
              type="number"
              inputMode="decimal"
              step="any"
              placeholder={currency.trim() ? `1 ${currency.trim().toUpperCase()} = ? ₫` : '1 unit = ? ₫'}
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              disabled={!currency.trim()}
              className="rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 disabled:opacity-50"
            />
          </div>
          <p className="text-xs text-stone-400">
            Leave currency blank to track this trip in ₫ like normal.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-pink-500 py-2 text-sm font-bold text-white shadow-md shadow-pink-200"
          >
            Create trip
          </button>
        </form>
      )}

      <ul className="space-y-2">
        {trips.map((t) => {
          const spent = totals[t.id] ?? 0
          return (
            <li key={t.id}>
              <Link
                to={`/trips/${t.id}`}
                className="block rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-700">{t.icon || '✈️'} {t.name}</span>
                  <span className="font-bold text-stone-800">{formatCurrency(spent)}</span>
                </div>
                <p className="mt-1 text-xs font-semibold text-stone-400">
                  {t.start_date ?? '—'} to {t.end_date ?? '—'}
                  {t.budget ? ` · budget ${formatCurrency(t.budget)}` : ''}
                  {t.currency ? ` · 1 ${currencySymbol(t.currency)} = ${t.exchange_rate ?? '?'} ₫` : ''}
                </p>
              </Link>
            </li>
          )
        })}
        {trips.length === 0 && <p className="text-sm text-stone-400">No trips yet.</p>}
      </ul>
    </Layout>
  )
}
