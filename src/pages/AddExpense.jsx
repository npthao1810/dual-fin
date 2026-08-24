import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import NumberPad from '../components/NumberPad'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { useAuth } from '../context/AuthContext'
import { toISODate } from '../lib/format'

export default function AddExpense() {
  const { household, categories } = useHousehold()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetTripId = searchParams.get('trip') ?? ''

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tripId, setTripId] = useState(presetTripId)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(toISODate(new Date()))
  const [trips, setTrips] = useState([])
  const [recentCategoryIds, setRecentCategoryIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!household) return
    supabase
      .from('trips')
      .select('id, name')
      .eq('household_id', household.id)
      .order('start_date', { ascending: false })
      .then(({ data }) => setTrips(data ?? []))

    supabase
      .from('expenses')
      .select('category_id')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const seen = []
        for (const row of data ?? []) {
          if (row.category_id && !seen.includes(row.category_id)) seen.push(row.category_id)
        }
        setRecentCategoryIds(seen)
      })
  }, [household])

  const orderedCategories = useMemo(() => {
    const recent = recentCategoryIds
      .map((id) => categories.find((c) => c.id === id))
      .filter(Boolean)
    const rest = categories.filter((c) => !recentCategoryIds.includes(c.id))
    return [...recent, ...rest]
  }, [categories, recentCategoryIds])

  function handleKey(key) {
    if (key === '⌫') {
      setAmount((prev) => prev.slice(0, -1))
      return
    }
    if (key === '.' && amount.includes('.')) return
    setAmount((prev) => (prev + key).slice(0, 10))
  }

  async function handleSubmit() {
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount')
      return
    }
    if (!household) return

    setSubmitting(true)
    setError(null)
    const { error } = await supabase.from('expenses').insert({
      household_id: household.id,
      category_id: categoryId || null,
      trip_id: tripId || null,
      amount: numericAmount,
      note: note || null,
      paid_by: user.id,
      date,
    })
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }
    navigate(tripId ? `/trips/${tripId}` : '/')
  }

  return (
    <Layout title="Add expense">
      <div className="mb-4 text-center">
        <span className="text-4xl font-bold tabular-nums">${amount || '0'}</span>
      </div>

      <div className="mb-4">
        <p className="mb-2 text-sm text-slate-400">Category</p>
        <div className="flex flex-wrap gap-2">
          {orderedCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id === categoryId ? '' : c.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${
                categoryId === c.id
                  ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                  : 'border-slate-700 text-slate-300'
              }`}
            >
              {c.icon ? `${c.icon} ` : ''}
              {c.name}
            </button>
          ))}
          {categories.length === 0 && (
            <p className="text-sm text-slate-500">Add categories in Settings first.</p>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm text-slate-400" htmlFor="date">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-400" htmlFor="trip">
            Trip (optional)
          </label>
          <select
            id="trip"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-sm"
          >
            <option value="">None</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-sm text-slate-400" htmlFor="note">
          Note (optional)
        </label>
        <input
          id="note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Groceries"
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
      </div>

      <NumberPad onPress={handleKey} />

      {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 w-full rounded-xl bg-emerald-500 py-3 font-semibold text-slate-950 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : 'Save expense'}
      </button>
    </Layout>
  )
}
