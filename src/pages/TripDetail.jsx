import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { useExpenses } from '../hooks/useExpenses'
import { formatCurrency } from '../lib/format'

export default function TripDetail() {
  const { id } = useParams()
  const { isYou } = useHousehold()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const { expenses, loading } = useExpenses({ tripId: id })

  useEffect(() => {
    supabase
      .from('trips')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => setTrip(data))
  }, [id])

  async function handleDeleteTrip() {
    if (!confirm(`Delete "${trip?.name}"? Expenses will be kept but unlinked from this trip.`)) return
    await supabase.from('trips').delete().eq('id', id)
    navigate('/trips')
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const youTotal = expenses.filter((e) => isYou(e.paid_by)).reduce((sum, e) => sum + Number(e.amount), 0)
  const partnerTotal = total - youTotal

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
        <p className="text-sm text-slate-500">Loading…</p>
      </Layout>
    )
  }

  return (
    <Layout title={trip.name}>
      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-sm text-slate-400">Total spent</p>
        <p className="mt-1 text-3xl font-bold">{formatCurrency(total)}</p>
        {trip.budget && (
          <p className="mt-1 text-xs text-slate-500">
            Budget {formatCurrency(trip.budget)}
            {total > trip.budget && <span className="ml-1 text-rose-400">· over budget</span>}
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-950 p-3 text-center">
            <p className="text-xs text-slate-500">You</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(youTotal)}</p>
          </div>
          <div className="rounded-xl bg-slate-950 p-3 text-center">
            <p className="text-xs text-slate-500">Partner</p>
            <p className="mt-1 text-lg font-semibold">{formatCurrency(partnerTotal)}</p>
          </div>
        </div>
      </section>

      <Link
        to={`/add?trip=${id}`}
        className="mb-6 block w-full rounded-xl bg-emerald-500 py-3 text-center font-semibold text-slate-950"
      >
        + Add expense to this trip
      </Link>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-slate-400">By category</h2>
        <ul className="space-y-2">
          {categoryRows.map(({ category, total: catTotal }) => (
            <li
              key={category?.id ?? 'uncategorized'}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3"
            >
              <span className="flex items-center gap-2">
                <span>{category?.icon ?? '💸'}</span>
                {category?.name ?? 'Uncategorized'}
              </span>
              <span className="font-semibold">{formatCurrency(catTotal)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-medium text-slate-400">Expenses</h2>
        {loading && <p className="text-sm text-slate-500">Loading…</p>}
        <ul className="space-y-2">
          {expenses.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {e.categories?.icon} {e.categories?.name ?? 'Uncategorized'}
                </p>
                <p className="text-xs text-slate-500">
                  {e.date} · {isYou(e.paid_by) ? 'You' : 'Partner'}
                  {e.note ? ` · ${e.note}` : ''}
                </p>
              </div>
              <span className="font-semibold">{formatCurrency(e.amount)}</span>
            </li>
          ))}
          {!loading && expenses.length === 0 && (
            <p className="text-sm text-slate-500">No expenses logged for this trip yet.</p>
          )}
        </ul>
      </section>

      <button
        type="button"
        onClick={handleDeleteTrip}
        className="w-full rounded-xl border border-rose-900 py-2.5 text-sm font-medium text-rose-400"
      >
        Delete trip
      </button>
    </Layout>
  )
}
