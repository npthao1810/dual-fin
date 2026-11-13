import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import NumberPad from '../components/NumberPad'
import BottomSheet from '../components/BottomSheet'
import CategorySheet from '../components/CategorySheet'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { useAuth } from '../context/AuthContext'
import { currencySymbol, formatCurrency, toISODate } from '../lib/format'
import { categoryIcon } from '../lib/categoryIcons'
import { rankCategoryIds, suggestCategoryId } from '../lib/categoryStats'
import { parseSpokenExpense } from '../lib/parseSpoken'
import { mutateOrQueue } from '../lib/mutate'
import { getQueue } from '../lib/offlineQueue'
import { readCache, writeCache } from '../lib/localCache'
import { expensesCacheKey } from '../hooks/useExpenses'
import { useRowsWithPending } from '../hooks/useRowsWithPending'
import { useTrips } from '../hooks/useTrips'

const FOR_OPTIONS = [
  { value: 'anh', label: 'Anh', icon: '/icons/nav/anh.png' },
  { value: 'em', label: 'Em', icon: '/icons/nav/em.png' },
  { value: 'us', label: 'Us', icon: '/icons/nav/us.png' },
]

const DRAFT_KEY = 'dualfin.addExpenseDraft'
const CURRENCY_OPTIONS = ['VND', 'USD', 'JPY', 'KRW', 'THB', 'EUR']
const TOP_PICKS = 6

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

function statsCacheKey(householdId) {
  return `category-stats:${householdId}`
}

function chipClass(active) {
  return active ? 'border-pink-400 bg-pink-100 text-pink-600' : 'border-stone-200 bg-white text-stone-500'
}

export default function AddExpense() {
  const { household, categories } = useHousehold()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const [searchParams] = useSearchParams()
  const presetTripId = searchParams.get('trip') ?? ''

  const draft = isEditing ? null : loadDraft()

  const [amount, setAmount] = useState(() => draft?.amount ?? '')
  const [name, setName] = useState(() => draft?.name ?? '')
  const [categoryId, setCategoryId] = useState(() => draft?.categoryId ?? '')
  // categoryTouched: the user chose a category themselves, so the note no
  // longer picks one for them. categoryAuto: the current one came from the note.
  const [categoryTouched, setCategoryTouched] = useState(() => draft?.categoryTouched ?? isEditing)
  const [categoryAuto, setCategoryAuto] = useState(false)
  const [forWhom, setForWhom] = useState(() => draft?.forWhom ?? 'us')
  const [emChi, setEmChi] = useState(() => draft?.emChi ?? false)
  const [tripId, setTripId] = useState(() => draft?.tripId ?? presetTripId)
  const [expenseType, setExpenseType] = useState(() => draft?.expenseType ?? (presetTripId ? 'trip' : 'daily'))
  // tripAuto: the trip was picked from the date. tripOverride: the user chose
  // Daily/Trip themselves, so the date no longer decides it.
  const [tripAuto, setTripAuto] = useState(() => draft?.tripAuto ?? false)
  const [tripOverride, setTripOverride] = useState(() => draft?.tripOverride ?? false)
  const [currency, setCurrency] = useState(() => draft?.currency ?? 'VND')
  const [currencyFromTrip, setCurrencyFromTrip] = useState(() => draft?.currencyFromTrip ?? false)
  const [exchangeRate, setExchangeRate] = useState(() => draft?.exchangeRate ?? '')
  const [chargedVnd, setChargedVnd] = useState(() => draft?.chargedVnd ?? '')
  const [date, setDate] = useState(() => draft?.date ?? toISODate(new Date()))
  const { trips: tripsFromHook } = useTrips()
  // Arriving from "+ Add expense to this trip" carries the trip immediately,
  // so the optional trip label is available before the cached list refreshes.
  const fromNavTrip = location.state?.trip
  const baseTrips =
    fromNavTrip && !tripsFromHook.some((t) => t.id === fromNavTrip.id)
      ? [fromNavTrip, ...tripsFromHook]
      : tripsFromHook
  const trips = useRowsWithPending(baseTrips, 'trips', household ? { household_id: household.id } : null)

  const statsKey = household ? statsCacheKey(household.id) : null
  const [recentExpenses, setRecentExpenses] = useState(() => (statsKey && readCache(statsKey)) || [])
  const [statsReady, setStatsReady] = useState(() => Boolean(statsKey && readCache(statsKey)))
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(null)
  const [sheet, setSheet] = useState(null) // 'details' | 'currency' | 'category' | null
  const didSetDefaultCategory = useRef(isEditing || Boolean(draft))

  useEffect(() => {
    if (!isEditing) return

    // A previous edit to this same expense may still be waiting to sync —
    // show that intended value rather than the (older) server row.
    function withPendingOverlay(data) {
      const pending = getQueue().find(
        (item) => item.table === 'expenses' && item.op === 'update' && item.match?.id === id
      )
      return pending ? { ...data, ...pending.payload } : data
    }

    function hydrate(data) {
      const merged = withPendingOverlay(data)
      setAmount(String(merged.original_amount ?? merged.amount))
      setName(merged.note ?? '')
      setCategoryId(merged.category_id ?? '')
      setForWhom(merged.for_whom ?? 'us')
      setEmChi(merged.em_chi ?? false)
      setTripId(merged.trip_id ?? '')
      setExpenseType(merged.expense_type ?? (merged.trip_id ? 'trip' : 'daily'))
      setCurrency(merged.currency ?? 'VND')
      setExchangeRate(merged.exchange_rate != null ? String(merged.exchange_rate) : '')
      setChargedVnd(merged.currency ? String(merged.amount) : '')
      setDate(merged.date)
    }

    // Render from whatever's cached (e.g. from History's list) immediately —
    // this is what keeps the form from opening blank while offline.
    if (household) {
      const cached = readCache(expensesCacheKey(household.id, {}))
      const cachedMatch = cached?.find((e) => e.id === id)
      if (cachedMatch) hydrate(cachedMatch)
    }

    supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) hydrate(data)
      })
  }, [id, isEditing, household])

  // Recent expenses drive three things: which categories are "top picks",
  // the default category, and the category suggested from the note.
  useEffect(() => {
    if (!household) return
    supabase
      .from('expenses')
      .select('category_id, note, date')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error: fetchError }) => {
        if (!fetchError && data) {
          setRecentExpenses(data)
          writeCache(statsCacheKey(household.id), data)
        }
        setStatsReady(true)
      })
  }, [household])

  const rankedIds = useMemo(() => rankCategoryIds(recentExpenses), [recentExpenses])

  // Pick the trip whose date range contains the expense date, along with its
  // currency and rate; leave it again when the date moves out of the range.
  const autoTrip = useMemo(
    () =>
      isEditing || presetTripId
        ? null
        : (trips.find((t) => t.start_date && t.end_date && date >= t.start_date && date <= t.end_date) ?? null),
    [trips, date, isEditing, presetTripId]
  )

  function applyTripCurrency(trip) {
    if (!trip?.currency) return
    setCurrency(trip.currency)
    setExchangeRate(trip.exchange_rate != null ? String(trip.exchange_rate) : '')
    setChargedVnd('')
    setCurrencyFromTrip(true)
  }

  function resetTripCurrency() {
    if (!currencyFromTrip) return
    setCurrency('VND')
    setExchangeRate('')
    setChargedVnd('')
    setCurrencyFromTrip(false)
  }

  useEffect(() => {
    if (isEditing || presetTripId || tripOverride) return
    if (autoTrip) {
      if (tripId === autoTrip.id) return
      setTripId(autoTrip.id)
      setExpenseType('trip')
      setTripAuto(true)
      applyTripCurrency(autoTrip)
    } else if (tripAuto) {
      setTripId('')
      setExpenseType('daily')
      setTripAuto(false)
      resetTripCurrency()
    }
    // applyTripCurrency/resetTripCurrency only read state this effect already tracks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTrip, tripOverride, tripAuto, tripId, isEditing, presetTripId])

  // What a fresh form starts on: your most-used category, else Food.
  function defaultCategoryId() {
    const topId = rankedIds.find((rid) => categories.some((c) => c.id === rid))
    const food = categories.find((c) => c.name.trim().toLowerCase() === 'food')
    return topId ?? food?.id ?? ''
  }

  useEffect(() => {
    if (didSetDefaultCategory.current || categories.length === 0 || !statsReady) return
    didSetDefaultCategory.current = true
    const pick = defaultCategoryId()
    if (pick) setCategoryId(pick)
    // defaultCategoryId only reads categories and rankedIds, both listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, rankedIds, statsReady])

  useEffect(() => {
    if (isEditing) return
    if (amount !== '' || name.trim() !== '') {
      saveDraft({
        amount, name, categoryId, categoryTouched, forWhom, emChi, tripId, expenseType, tripAuto, tripOverride,
        currency, currencyFromTrip, exchangeRate, chargedVnd, date,
      })
    } else {
      clearDraft()
    }
  }, [
    isEditing, amount, name, categoryId, categoryTouched, forWhom, emChi, tripId, expenseType, tripAuto, tripOverride,
    currency, currencyFromTrip, exchangeRate, chargedVnd, date,
  ])

  const topPicks = useMemo(() => {
    const ranked = rankedIds.map((rid) => categories.find((c) => c.id === rid)).filter(Boolean)
    const base = ranked.length > 0 ? ranked : categories
    const picks = base.slice(0, TOP_PICKS)
    const selected = categories.find((c) => c.id === categoryId)
    // The chosen category is always visible, even when it isn't a top pick.
    return selected && !picks.some((c) => c.id === selected.id) ? [selected, ...picks.slice(0, TOP_PICKS - 1)] : picks
  }, [categories, rankedIds, categoryId])

  const suggestedId = useMemo(() => {
    const id = suggestCategoryId(name, recentExpenses)
    return id && categories.some((c) => c.id === id) ? id : null
  }, [name, recentExpenses, categories])

  // Until the user picks a category themselves, follow what the note suggests.
  useEffect(() => {
    if (isEditing || categoryTouched || !suggestedId || suggestedId === categoryId) return
    setCategoryId(suggestedId)
    setCategoryAuto(true)
  }, [isEditing, categoryTouched, suggestedId, categoryId])

  function pickCategory(nextId) {
    setCategoryTouched(true)
    setCategoryAuto(false)
    setCategoryId(nextId)
  }

  const suggestedCategory =
    categoryTouched && suggestedId && suggestedId !== categoryId ? categories.find((c) => c.id === suggestedId) : null
  const autoCategory = categoryAuto && suggestedId === categoryId ? categories.find((c) => c.id === categoryId) : null

  function handleKey(key) {
    if (key === '⌫') {
      setAmount((prev) => prev.slice(0, -1))
      return
    }
    if (key === '.') {
      setAmount((prev) => (prev.includes('.') ? prev : `${prev || '0'}.`))
      return
    }
    setAmount((prev) => (prev === '0' ? key : (prev + key).slice(0, 12)))
  }

  const displayAmount = amount ? Number(amount).toLocaleString('vi-VN') : '0'

  const activeCurrency = currency.trim().toUpperCase() || 'VND'
  const isForeignCurrency = activeCurrency !== 'VND'

  // Dictated or typed "cafe 65k anh trả": offer to fill amount, payer and
  // whom it was for. Only while the amount is still empty and in VND, so it
  // never fights with numbers typed on the pad.
  const spoken = useMemo(() => parseSpokenExpense(name), [name])
  const canApplySpoken = !isEditing && amount === '' && !isForeignCurrency && spoken.amount > 0
  function applySpoken() {
    setAmount(String(spoken.amount))
    setName(spoken.note)
    if (spoken.emChi !== undefined) setEmChi(spoken.emChi)
    if (spoken.forWhom) setForWhom(spoken.forWhom)
  }
  const activeRate = Number(exchangeRate) || null
  const calculatedVnd = isForeignCurrency && activeRate && amount ? Math.round(Number(amount) * activeRate) : null
  const vndPreview = chargedVnd ? Number(chargedVnd) : calculatedVnd

  const { today, yesterday } = useMemo(() => {
    const now = new Date()
    return { today: toISODate(now), yesterday: toISODate(new Date(now.getTime() - 24 * 60 * 60 * 1000)) }
  }, [])
  const dateBadge = date === today ? 'Today' : date === yesterday ? 'Yesterday' : null

  // Anything changed from a fresh form? Drives the Reset button.
  const isDirty =
    !isEditing &&
    (amount !== '' ||
      name.trim() !== '' ||
      categoryTouched ||
      forWhom !== 'us' ||
      emChi ||
      tripOverride ||
      date !== today ||
      (currency !== 'VND' && !currencyFromTrip))

  // Back to what opening Add fresh shows (a trip picked by date is re-applied
  // by the effect above, just like on a fresh open).
  function resetForm() {
    setAmount('')
    setName('')
    setCategoryId(defaultCategoryId())
    setCategoryTouched(false)
    setCategoryAuto(false)
    setForWhom('us')
    setEmChi(false)
    setTripId(presetTripId)
    setExpenseType(presetTripId ? 'trip' : 'daily')
    setTripAuto(false)
    setTripOverride(false)
    setCurrency('VND')
    setCurrencyFromTrip(false)
    setExchangeRate('')
    setChargedVnd('')
    setDate(toISODate(new Date()))
    setError(null)
    setSheet(null)
    didSetDefaultCategory.current = true
    clearDraft()
  }
  const dateLabel = useMemo(() => {
    if (dateBadge) return dateBadge
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }, [date, dateBadge])

  function shiftDate(days) {
    const [y, m, d] = date.split('-').map(Number)
    setDate(toISODate(new Date(y, m - 1, d + days)))
  }

  const selectedTrip = trips.find((t) => t.id === tripId) ?? null
  const forLabel = FOR_OPTIONS.find((o) => o.value === forWhom)?.label ?? 'Us'

  function chooseBudgetType(type) {
    setTripOverride(true)
    setExpenseType(type)
    if (type === 'daily') {
      setTripId('')
      setTripAuto(false)
      resetTripCurrency()
    }
  }

  function chooseTrip(nextTripId) {
    setTripOverride(true)
    setTripAuto(false)
    setTripId(nextTripId)
    const trip = trips.find((t) => t.id === nextTripId)
    if (trip && !isEditing) applyTripCurrency(trip)
    else if (!trip) resetTripCurrency()
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
    if (isForeignCurrency && !chargedVnd && !activeRate) {
      setError(`Enter the VND amount charged or an exchange rate for ${activeCurrency}`)
      return
    }
    if (!household) return

    setSubmitting(true)
    setError(null)
    const payload = {
      household_id: household.id,
      category_id: categoryId || null,
      trip_id: expenseType === 'trip' && tripId ? tripId : null,
      expense_type: expenseType,
      amount: isForeignCurrency ? Math.round(Number(chargedVnd) || numericAmount * activeRate) : numericAmount,
      original_amount: isForeignCurrency ? numericAmount : null,
      currency: isForeignCurrency ? activeCurrency : null,
      exchange_rate: isForeignCurrency && activeRate ? activeRate : null,
      note: name.trim(),
      for_whom: forWhom,
      em_chi: emChi,
      date,
    }

    if (isEditing) {
      const { error } = await mutateOrQueue({ table: 'expenses', op: 'update', match: { id }, payload })
      setSubmitting(false)
      if (error) {
        setError(error.message)
        return
      }
      navigate(expenseType === 'trip' && tripId ? `/trips/${tripId}` : '/history')
      return
    }

    const newExpense = { id: crypto.randomUUID(), ...payload, paid_by: user.id }
    const { error } = await mutateOrQueue({ table: 'expenses', op: 'insert', payload: newExpense })
    setSubmitting(false)

    if (error) {
      setError(error.message)
      return
    }
    clearDraft()
    navigate(expenseType === 'trip' && tripId ? `/trips/${tripId}` : '/')
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const { error } = await mutateOrQueue({ table: 'expenses', op: 'delete', match: { id } })
    setDeleting(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/history')
  }

  return (
    <Layout title={isEditing ? 'Edit expense' : 'Add expense'}>
      <div className="relative mb-5 mt-1 text-center">
        {isDirty && (
          <button
            type="button"
            onClick={resetForm}
            aria-label="Reset the form to empty"
            className="absolute right-0 top-0 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold text-stone-400 active:text-pink-500"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10a6 6 0 1 0 2-4.5" />
              <path d="M4 3.5V6.5h3" />
            </svg>
            Reset
          </button>
        )}
        <div className="flex items-center justify-center gap-3">
          <span className="text-5xl font-bold tabular-nums text-stone-800">{displayAmount}</span>
          <button
            type="button"
            onClick={() => setSheet('currency')}
            aria-label={`Currency: ${activeCurrency}. Change currency`}
            className="rounded-full border border-pink-200 bg-white px-3 py-1.5 text-sm font-bold text-stone-500"
          >
            {currencySymbol(activeCurrency)} {activeCurrency} ▾
          </button>
        </div>
        {isForeignCurrency && (
          <p className="mt-2 text-sm font-semibold text-stone-400">
            {vndPreview != null
              ? `Counts as ${formatCurrency(vndPreview)}`
              : activeRate
                ? `1 ${activeCurrency} = ${activeRate.toLocaleString('vi-VN', { maximumFractionDigits: 4 })} ₫`
                : 'Tap the currency to add the VND charge or rate'}
            {currencyFromTrip && selectedTrip ? ` · ${selectedTrip.name} rate` : ''}
          </p>
        )}
      </div>

      <div className="mb-5">
        <label className="sr-only" htmlFor="name">Name</label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What was it? e.g. Groceries"
          className="w-full rounded-2xl border border-pink-200 bg-white px-4 py-3 text-base text-stone-700 placeholder:text-stone-300"
        />
        {canApplySpoken && (
          <button
            type="button"
            onClick={applySpoken}
            className="mt-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-sm font-semibold text-pink-600"
          >
            ✨ {formatCurrency(spoken.amount)}
            {spoken.emChi !== undefined ? ` · ${spoken.emChi ? 'Em chi' : 'Anh chi'}` : ''}
            {spoken.forWhom ? ` · ${FOR_OPTIONS.find((o) => o.value === spoken.forWhom)?.label}` : ''}
            {' '}— tap to fill
          </button>
        )}
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-stone-500">Category</p>
          {categories.length > 0 && (
            <button type="button" onClick={() => setSheet('category')} className="text-sm font-bold text-pink-500">
              All {categories.length} ›
            </button>
          )}
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {topPicks.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickCategory(c.id === categoryId ? '' : c.id)}
              aria-pressed={categoryId === c.id}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-semibold ${chipClass(categoryId === c.id)}`}
            >
              {categoryIcon(c)} {c.name}
            </button>
          ))}
          {categories.length === 0 && <p className="text-sm text-stone-400">Add categories in Settings first.</p>}
        </div>
        {autoCategory && (
          <p className="mt-2 text-xs font-semibold text-amber-600">
            ✨ {autoCategory.name} — suggested from similar notes. Tap another to change.
          </p>
        )}
        {suggestedCategory && (
          <button
            type="button"
            onClick={() => pickCategory(suggestedCategory.id)}
            className="mt-2 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-700"
          >
            ✨ {categoryIcon(suggestedCategory)} {suggestedCategory.name}? <span className="font-semibold">tap to use</span>
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSheet('details')}
        aria-label="Edit who paid, who it is for, date and trip"
        className="mb-5 flex w-full items-center justify-between gap-3 rounded-2xl border border-pink-100 bg-white px-4 py-3 text-left shadow-sm shadow-pink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
      >
        <span className="block min-w-0 truncate text-sm font-semibold text-stone-600">
          {forLabel} · {emChi ? 'Em chi' : 'Anh chi'} · {dateLabel} ·{' '}
          {expenseType === 'trip' ? (
            <span className="text-orange-600">
              ✈️ {selectedTrip?.name ?? 'Trip'}
              {tripAuto && <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold">auto</span>}
            </span>
          ) : (
            <span>🏠 Daily</span>
          )}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="h-4 w-4 flex-shrink-0 text-pink-500"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M13.5 3.5l3 3L7 16l-4 1 1-4 9.5-9.5z" />
        </svg>
      </button>

      <div className="mb-4">
        <NumberPad onPress={handleKey} allowDecimal={isForeignCurrency} />
      </div>

      <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-10 -mx-4 bg-gradient-to-t from-orange-50 via-orange-50 to-transparent px-4 pb-2 pt-3">
        {error && <p className="mb-2 text-sm font-semibold text-rose-500">{error}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full rounded-full bg-pink-500 py-3 font-bold text-white shadow-md shadow-pink-200 disabled:opacity-60"
        >
          {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Save expense'}
        </button>
      </div>

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

      <CategorySheet
        open={sheet === 'category'}
        onClose={() => setSheet(null)}
        categories={categories}
        rankedIds={rankedIds}
        selectedId={categoryId}
        onSelect={pickCategory}
      />

      <BottomSheet open={sheet === 'currency'} onClose={() => setSheet(null)} title="Currency">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {CURRENCY_OPTIONS.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setCurrency(code)
                setCurrencyFromTrip(false)
                if (code === 'VND') {
                  setExchangeRate('')
                  setChargedVnd('')
                }
              }}
              className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${chipClass(activeCurrency === code)}`}
            >
              {code}
            </button>
          ))}
        </div>
        <label className="mt-3 block text-xs font-semibold text-stone-400" htmlFor="custom-currency">
          Other currency
        </label>
        <input
          id="custom-currency"
          type="text"
          maxLength={6}
          value={CURRENCY_OPTIONS.includes(activeCurrency) ? '' : currency}
          onChange={(e) => {
            setCurrency(e.target.value.toUpperCase())
            setCurrencyFromTrip(false)
          }}
          placeholder="e.g. SGD"
          className="mt-1 w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm uppercase text-stone-700 placeholder:normal-case placeholder:text-stone-300"
        />
        {isForeignCurrency && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold text-stone-400">
              Actual charge in VND
              <input
                type="number"
                inputMode="decimal"
                value={chargedVnd}
                onChange={(e) => setChargedVnd(e.target.value)}
                placeholder="Most accurate"
                className="mt-1 w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300"
              />
            </label>
            <label className="text-xs font-semibold text-stone-400">
              1 {activeCurrency} in VND
              <input
                type="number"
                inputMode="decimal"
                step="any"
                value={exchangeRate}
                onChange={(e) => {
                  setExchangeRate(e.target.value)
                  setCurrencyFromTrip(false)
                }}
                placeholder="Exchange rate"
                className="mt-1 w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300"
              />
            </label>
          </div>
        )}
      </BottomSheet>

      <BottomSheet open={sheet === 'details'} onClose={() => setSheet(null)} title="Details">
        <p className="mb-2 text-sm font-semibold text-stone-500">For</p>
        <div className="mb-4 flex gap-2">
          {FOR_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForWhom(opt.value)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${chipClass(forWhom === opt.value)}`}
            >
              <img src={opt.icon} alt="" className="h-5 w-5" />
              {opt.label}
            </button>
          ))}
        </div>

        <p className="mb-2 text-sm font-semibold text-stone-500">Paid by</p>
        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => setEmChi(false)} className={`flex-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${chipClass(!emChi)}`}>
            Anh chi
          </button>
          <button type="button" onClick={() => setEmChi(true)} className={`flex-1 rounded-full border px-3 py-1.5 text-sm font-semibold ${chipClass(emChi)}`}>
            Em chi
          </button>
        </div>

        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-500" htmlFor="date">
          Date
          {dateBadge && <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-600">{dateBadge}</span>}
        </label>
        <div className="mb-4 flex items-center gap-1">
          <button type="button" onClick={() => shiftDate(-1)} aria-label="Previous day" className="rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm font-bold text-stone-500">
            ‹
          </button>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full min-w-0 flex-1 rounded-xl border border-pink-200 bg-white px-2 py-2 text-sm text-stone-700"
          />
          <button type="button" onClick={() => shiftDate(1)} aria-label="Next day" className="rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm font-bold text-stone-500">
            ›
          </button>
        </div>

        <p className="mb-2 text-sm font-semibold text-stone-500">Budget</p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {[
            { value: 'daily', label: '🏠 Daily' },
            { value: 'trip', label: '✈️ Trip' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => chooseBudgetType(option.value)}
              className={`rounded-2xl border px-3 py-2.5 text-sm font-bold ${chipClass(expenseType === option.value)}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {tripAuto && selectedTrip && (
          <p className="mb-3 text-xs font-semibold text-orange-600">
            Picked automatically because the date is within {selectedTrip.name}. Choose Daily to override.
          </p>
        )}
        {expenseType === 'trip' && (
          <>
            <label className="mb-1 block text-sm font-semibold text-stone-500" htmlFor="trip">
              Trip (optional)
            </label>
            <select
              id="trip"
              value={tripId}
              onChange={(e) => chooseTrip(e.target.value)}
              className="w-full rounded-xl border border-pink-200 bg-white px-2 py-2 text-sm text-stone-700"
            >
              <option value="">None</option>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </>
        )}
      </BottomSheet>
    </Layout>
  )
}
