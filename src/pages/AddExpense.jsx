import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import NumberPad from '../components/NumberPad'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { useAuth } from '../context/AuthContext'
import { currencySymbol, formatCurrency, toISODate } from '../lib/format'
import { categoryIcon } from '../lib/categoryIcons'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { enqueueExpense } from '../lib/offlineQueue'

const FOR_OPTIONS = [
  { value: 'anh', label: 'Anh', icon: '/icons/nav/anh.png' },
  { value: 'em', label: 'Em', icon: '/icons/nav/em.png' },
  { value: 'us', label: 'Us', icon: '/icons/nav/us.png' },
]

const DRAFT_KEY = 'dualfin.addExpenseDraft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveDraft(draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // ignore storage errors (e.g. private browsing quota)
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

export default function AddExpense() {
  const { household, categories } = useHousehold()
  const { user } = useAuth()
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const [searchParams] = useSearchParams()
  const presetTripId = searchParams.get('trip') ?? ''

  const draft = isEditing ? null : loadDraft()

  const [amount, setAmount] = useState(() => draft?.amount ?? '')
  const [name, setName] = useState(() => draft?.name ?? '')
  const [categoryId, setCategoryId] = useState(() => draft?.categoryId ?? '')
  const [forWhom, setForWhom] = useState(() => draft?.forWhom ?? 'us')
  const [emChi, setEmChi] = useState(() => draft?.emChi ?? false)
  const [tripId, setTripId] = useState(() => draft?.tripId ?? presetTripId)
  const [date, setDate] = useState(() => draft?.date ?? toISODate(new Date()))
  const [trips, setTrips] = useState([])
  const [recentCategoryIds, setRecentCategoryIds] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)
  const didSetDefaultCategory = useRef(isEditing || Boolean(draft))

  useEffect(() => {
    if (!isEditing) return
    supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setAmount(String(data.original_amount ?? data.amount))
        setName(data.note ?? '')
        setCategoryId(data.category_id ?? '')
        setForWhom(data.for_whom ?? 'us')
        setEmChi(data.em_chi ?? false)
        setTripId(data.trip_id ?? '')
        setDate(data.date)
      })
  }, [id, isEditing])

  useEffect(() => {
    if (!household) return
    supabase
      .from('trips')
      .select('id, name, currency, exchange_rate')
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

  useEffect(() => {
    if (didSetDefaultCategory.current || categories.length === 0) return
    didSetDefaultCategory.current = true
    const food = categories.find((c) => c.name.trim().toLowerCase() === 'food')
    if (food) setCategoryId(food.id)
  }, [categories])

  useEffect(() => {
    if (isEditing) return
    if (amount !== '' || name.trim() !== '') {
      saveDraft({ amount, name, categoryId, forWhom, emChi, tripId, date })
    } else {
      clearDraft()
    }
  }, [isEditing, amount, name, categoryId, forWhom, emChi, tripId, date])

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
    setAmount((prev) => (prev === '0' ? key : (prev + key).slice(0, 12)))
  }

  const displayAmount = amount ? Number(amount).toLocaleString('vi-VN') : '0'

  const activeTrip = trips.find((t) => t.id === tripId)
  const activeCurrency = activeTrip?.currency ?? null
  const activeRate = activeTrip?.exchange_rate != null ? Number(activeTrip.exchange_rate) : null
  const vndPreview =
    activeCurrency && activeRate && amount ? Math.round(Number(amount) * activeRate) : null

  const { today, yesterday } = useMemo(() => {
    const now = new Date()
    return { today: toISODate(now), yesterday: toISODate(new Date(now.getTime() - 24 * 60 * 60 * 1000)) }
  }, [])
  const dateBadge = date === today ? 'Today' : date === yesterday ? 'Yesterday' : null

  function shiftDate(days) {
    const [y, m, d] = date.split('-').map(Number)
    setDate(toISODate(new Date(y, m - 1, d + days)))
  }

  async function handleSubmit() {
    const numericAmount = Number(amount)
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter an amount')
      return
    }
    if (!name.trim()) {
      setError('Enter a name for the expense')
      return
    }
    if (activeCurrency && !activeRate) {
      setError(`Set an exchange rate for ${activeCurrency} on this trip first`)
      return
    }
    if (!household) return

    setSubmitting(true)
    setError(null)
    const payload = {
      household_id: household.id,
      category_id: categoryId || null,
      trip_id: tripId || null,
      amount: activeCurrency ? Math.round(numericAmount * activeRate) : numericAmount,
      original_amount: activeCurrency ? numericAmount : null,
      currency: activeCurrency,
      note: name.trim(),
      for_whom: forWhom,
      em_chi: emChi,
      date,
    }

    if (isEditing) {
      const { error } = await supabase.from('expenses').update(payload).eq('id', id)
      setSubmitting(false)
      if (error) {
        setError(error.message)
        return
      }
      navigate(tripId ? `/trips/${tripId}` : '/history')
      return
    }

    const newExpense = { id: crypto.randomUUID(), ...payload, paid_by: user.id }

    if (!isOnline) {
      enqueueExpense({ ...newExpense, queuedAt: new Date().toISOString() })
      clearDraft()
      setSubmitting(false)
      navigate(tripId ? `/trips/${tripId}` : '/')
      return
    }

    let error = null
    try {
      ;({ error } = await supabase.from('expenses').insert(newExpense))
    } catch {
      enqueueExpense({ ...newExpense, queuedAt: new Date().toISOString() })
      clearDraft()
      setSubmitting(false)
      navigate(tripId ? `/trips/${tripId}` : '/')
      return
    }
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }
    clearDraft()
    navigate(tripId ? `/trips/${tripId}` : '/')
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/history')
  }

  return (
    <Layout title={isEditing ? 'Edit expense' : 'Add expense'}>
      <div className="mb-4 text-center">
        <span className="text-4xl font-bold tabular-nums text-stone-800">
          {displayAmount} {currencySymbol(activeCurrency)}
        </span>
        {activeCurrency && (
          <p className="mt-1 text-sm font-semibold text-stone-400">
            {vndPreview != null ? `≈ ${formatCurrency(vndPreview)}` : `Set this trip's exchange rate below`}
          </p>
        )}
      </div>

      <div className="mb-4">
        <NumberPad onPress={handleKey} />
      </div>

      <section className="mb-4 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
        <div className="mb-4">
          <label className="mb-1 block text-sm font-semibold text-stone-500" htmlFor="name">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Groceries"
            className="w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300"
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-stone-500">Category</p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {orderedCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id === categoryId ? '' : c.id)}
                className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  categoryId === c.id
                    ? 'border-pink-400 bg-pink-100 text-pink-600'
                    : 'border-stone-200 bg-white text-stone-500'
                }`}
              >
                {categoryIcon(c)} {c.name}
              </button>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-stone-400">Add categories in Settings first.</p>
            )}
          </div>
        </div>
      </section>

      <section className="mb-4 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
        <div className="mb-4">
          <p className="mb-2 text-sm font-semibold text-stone-500">For</p>
          <div className="flex gap-2">
            {FOR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForWhom(opt.value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                  forWhom === opt.value
                    ? 'border-pink-400 bg-pink-100 text-pink-600'
                    : 'border-stone-200 bg-white text-stone-500'
                }`}
              >
                <img src={opt.icon} alt="" className="h-5 w-5" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-stone-500">Paid by</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEmChi(false)}
              className={`flex-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                !emChi ? 'border-pink-400 bg-pink-100 text-pink-600' : 'border-stone-200 bg-white text-stone-500'
              }`}
            >
              Anh chi
            </button>
            <button
              type="button"
              onClick={() => setEmChi(true)}
              className={`flex-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                emChi ? 'border-pink-400 bg-pink-100 text-pink-600' : 'border-stone-200 bg-white text-stone-500'
              }`}
            >
              Em chi
            </button>
          </div>
        </div>
      </section>

      <section className="mb-4 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 flex items-center gap-2 text-sm font-semibold text-stone-500" htmlFor="date">
              Date
              {dateBadge && (
                <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-600">
                  {dateBadge}
                </span>
              )}
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => shiftDate(-1)}
                aria-label="Previous day"
                className="rounded-xl border border-pink-200 bg-white px-2 py-2 text-sm font-bold text-stone-500"
              >
                ‹
              </button>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full min-w-0 flex-1 rounded-xl border border-pink-200 bg-white px-2 py-2 text-sm text-stone-700"
              />
              <button
                type="button"
                onClick={() => shiftDate(1)}
                aria-label="Next day"
                className="rounded-xl border border-pink-200 bg-white px-2 py-2 text-sm font-bold text-stone-500"
              >
                ›
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-stone-500" htmlFor="trip">
              Trip (optional)
            </label>
            <select
              id="trip"
              value={tripId}
              onChange={(e) => setTripId(e.target.value)}
              className="w-full rounded-xl border border-pink-200 bg-white px-2 py-2 text-sm text-stone-700"
            >
              <option value="">None</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.currency ? ` (${currencySymbol(t.currency)})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {error && <p className="mt-3 text-sm font-semibold text-rose-500">{error}</p>}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-4 w-full rounded-full bg-pink-500 py-3 font-bold text-white shadow-md shadow-pink-200 disabled:opacity-60"
      >
        {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Save expense'}
      </button>

      {isEditing && !confirmDelete && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mt-3 w-full rounded-full border border-rose-200 py-2.5 text-sm font-bold text-rose-500"
        >
          Delete expense
        </button>
      )}

      {isEditing && confirmDelete && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            disabled={deleting}
            className="flex-1 rounded-full border border-stone-200 py-2.5 text-sm font-bold text-stone-500 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 rounded-full bg-rose-500 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      )}
    </Layout>
  )
}
