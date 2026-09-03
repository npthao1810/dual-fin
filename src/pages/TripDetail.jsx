import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { useExpensesWithPending } from '../hooks/useExpensesWithPending'
import { useRowsWithPending } from '../hooks/useRowsWithPending'
import { currencySymbol, formatCurrency, formatForeign } from '../lib/format'
import { categoryIcon } from '../lib/categoryIcons'
import { readCache } from '../lib/localCache'
import { mutateOrQueue } from '../lib/mutate'

export default function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { household } = useHousehold()
  const [baseTrips, setBaseTrips] = useState(() => {
    const cached = household && readCache(`trips:${household.id}`)
    return cached?.trips ?? []
  })
  const trip =
    useRowsWithPending(baseTrips, 'trips', household ? { household_id: household.id } : null).find(
      (t) => t.id === id
    ) ?? null
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)
  const { expenses, loading } = useExpensesWithPending({ tripId: id })

  function refreshTrip() {
    supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        // Keep showing the cached/previous trip if this fetch failed (e.g. offline).
        if (!data) return
        setBaseTrips((prev) => [...prev.filter((t) => t.id !== id), data])
      })
  }

  useEffect(refreshTrip, [id])

  async function handleUpdateCurrency(field, value) {
    const trimmed = value.trim()
    if (trimmed === String(trip[field] ?? '')) return
    const parsed = field === 'exchange_rate' ? (trimmed ? Number(trimmed) : null) : trimmed.toUpperCase() || null
    const updates = { [field]: parsed }
    if (field === 'currency' && !trimmed) updates.exchange_rate = null
    // Queued: the pending overlay (useRowsWithPending) shows it immediately.
    // Not queued: it's already live, so pull the real row to replace baseTrips.
    const { queued } = await mutateOrQueue({ table: 'trips', op: 'update', match: { id }, payload: updates })
    if (!queued) refreshTrip()
  }

  async function handleUpdateIcon(value) {
    const trimmed = value.trim()
    if (trimmed === (trip.icon ?? '')) return
    const { queued } = await mutateOrQueue({ table: 'trips', op: 'update', match: { id }, payload: { icon: trimmed || null } })
    if (!queued) refreshTrip()
  }

  async function handleDeleteTrip() {
    setDeleting(true)
    setDeleteError(null)
    const { error } = await mutateOrQueue({ table: 'trips', op: 'delete', match: { id } })
    setDeleting(false)
    if (error) {
      setDeleteError(error.message)
      return
    }
    navigate('/trips')
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const emChiTotal = expenses.filter((e) => e.em_chi).reduce((sum, e) => sum + Number(e.amount), 0)
  const anhChiTotal = total - emChiTotal

  const byCategory = {}
  for (const e of expenses) {
    const key = e.categories?.id ?? 'uncategorized'
    if (!byCategory[key]) byCategory[key] = { category: e.categories, total: 0 }
    byCategory[key].total += Number(e.amount)
  }
  const categoryRows = Object.values(byCategory).sort((a, b) => b.total - a.total)

  if (!trip) {
    return (
      <Layout title="Trip">
        <p className="text-sm text-stone-400">Loading…</p>
      </Layout>
    )
  }

  return (
    <Layout title={`${trip.icon || '✈️'} ${trip.name}`}>
      <section className="mb-6 rounded-3xl border border-pink-100 bg-white p-4 shadow-sm shadow-pink-50">
        {trip.pending && trip.status === 'pending' && (
          <p className="mb-2 text-xs font-bold text-amber-500">🔄 Pending sync</p>
        )}
        {trip.pending && trip.status === 'error' && (
          <p className="mb-2 text-xs font-bold text-rose-500">⚠️ Couldn't sync: {trip.errorMessage}</p>
        )}
        <p className="text-sm font-semibold text-stone-400">Total spent</p>
        <p className="mt-1 text-3xl font-bold text-stone-800">{formatCurrency(total)}</p>
        {trip.budget && (
          <p className="mt-1 text-xs font-semibold text-stone-400">
            Budget {formatCurrency(trip.budget)}
            {total > trip.budget && <span className="ml-1 text-rose-500">· over budget</span>}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-pink-50 pt-3">
          <span className="text-xs font-semibold text-stone-400">Icon</span>
          <input
            type="text"
            defaultValue={trip.icon ?? ''}
            placeholder="✈️"
            maxLength={2}
            onBlur={(e) => handleUpdateIcon(e.target.value)}
            className="w-12 rounded-lg border border-pink-200 bg-white px-2 py-1 text-center text-sm"
          />
        </div>

        <div className="mt-3 flex items-center gap-2 border-t border-pink-50 pt-3">
          <span className="text-xs font-semibold text-stone-400">Currency</span>
          <input
            type="text"
            defaultValue={trip.currency ?? ''}
            placeholder="₫ (none)"
            onBlur={(e) => handleUpdateCurrency('currency', e.target.value)}
            className="w-20 rounded-lg border border-pink-200 bg-white px-2 py-1 text-center text-xs uppercase text-stone-700 placeholder:text-stone-300 placeholder:normal-case"
          />
          {trip.currency && (
            <>
              <span className="text-xs text-stone-400">
                1 {currencySymbol(trip.currency)} =
              </span>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                defaultValue={trip.exchange_rate ?? ''}
                placeholder="rate"
                onBlur={(e) => handleUpdateCurrency('exchange_rate', e.target.value)}
                className="w-20 rounded-lg border border-pink-200 bg-white px-2 py-1 text-center text-xs text-stone-700 placeholder:text-stone-300"
              />
              <span className="text-xs text-stone-400">₫</span>
            </>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-pink-50 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <img src="/icons/nav/anh.png" alt="" className="h-5 w-5" />
              <p className="text-xs font-semibold text-stone-400">Anh chi</p>
            </div>
            <p className="mt-1 text-lg font-bold text-stone-800">{formatCurrency(anhChiTotal)}</p>
          </div>
          <div className="rounded-2xl bg-orange-50 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5">
              <img src="/icons/nav/em.png" alt="" className="h-5 w-5" />
              <p className="text-xs font-semibold text-stone-400">Em chi</p>
            </div>
            <p className="mt-1 text-lg font-bold text-stone-800">{formatCurrency(emChiTotal)}</p>
          </div>
        </div>
      </section>

      <Link
        to={`/add?trip=${id}`}
        state={{ trip }}
        className="mb-6 block w-full rounded-full bg-pink-500 py-3 text-center font-bold text-white shadow-md shadow-pink-200"
      >
        + Add expense to this trip
      </Link>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">By category</h2>
        <ul className="space-y-2">
          {categoryRows.map(({ category, total: catTotal }) => (
            <li
              key={category?.id ?? 'uncategorized'}
              className="flex items-center justify-between rounded-2xl border border-pink-100 bg-white p-3 shadow-sm shadow-pink-50"
            >
              <span className="flex items-center gap-2 font-semibold text-stone-700">
                <span>{categoryIcon(category)}</span>
                {category?.name ?? 'Uncategorized'}
              </span>
              <span className="font-bold text-stone-800">{formatCurrency(catTotal)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold text-stone-500">Expenses</h2>
        {loading && <p className="text-sm text-stone-400">Loading…</p>}
        <ul className="space-y-2">
          {expenses.map((e) => (
            <li
              key={e.id}
              className={`flex items-center justify-between rounded-2xl border p-3 text-sm shadow-sm ${
                e.pending
                  ? 'border-dashed border-amber-200 bg-white/70 opacity-80 shadow-none'
                  : 'border-pink-100 bg-white shadow-pink-50'
              }`}
            >
              <div>
                <p className="font-semibold text-stone-700">
                  {categoryIcon(e.categories)} {e.categories?.name ?? 'Uncategorized'}
                </p>
                <p className="text-xs font-semibold text-stone-400">
                  {e.date} · {e.em_chi ? 'Em chi' : 'Anh chi'}
                  {e.note ? ` · ${e.note}` : ''}
                </p>
                {e.pending && (
                  <p className="mt-1 text-xs font-bold text-amber-500">
                    {e.status === 'error' ? `⚠️ Couldn't sync: ${e.errorMessage}` : '🔄 Pending sync'}
                  </p>
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
            </li>
          ))}
          {!loading && expenses.length === 0 && (
            <p className="text-sm text-stone-400">No expenses logged for this trip yet.</p>
          )}
        </ul>
      </section>

      {deleteError && <p className="mb-3 text-sm font-semibold text-rose-500">{deleteError}</p>}

      {!confirmDelete && (
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="w-full rounded-full border border-rose-200 py-2.5 text-sm font-bold text-rose-500"
        >
          Delete trip
        </button>
      )}

      {confirmDelete && (
        <div className="space-y-2">
          <p className="text-center text-xs font-semibold text-stone-400">
            Delete "{trip.name}"? Expenses will be kept but unlinked from this trip.
          </p>
          <div className="flex gap-2">
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
              onClick={handleDeleteTrip}
              disabled={deleting}
              className="flex-1 rounded-full bg-rose-500 py-2.5 text-sm font-bold text-white disabled:opacity-60"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      )}
    </Layout>
  )
}
