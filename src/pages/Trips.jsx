import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { formatCurrency } from '../lib/format'

export default function Trips() {
  const { household } = useHousehold()
  const [trips, setTrips] = useState([])
  const [totals, setTotals] = useState({})
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [budget, setBudget] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadTrips() {
    if (!household) return
    const { data } = await supabase
      .from('trips')
      .select('*')
      .eq('household_id', household.id)
      .order('start_date', { ascending: false })
    setTrips(data ?? [])

    const { data: expenseData } = await supabase
      .from('expenses')
      .select('trip_id, amount')
      .eq('household_id', household.id)
      .not('trip_id', 'is', null)

    const sums = {}
    for (const e of expenseData ?? []) {
      sums[e.trip_id] = (sums[e.trip_id] ?? 0) + Number(e.amount)
    }
    setTotals(sums)
  }

  useEffect(() => {
    loadTrips()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household])

  async function handleCreate(e) {
    e.preventDefault()
    if (!name.trim() || !household) return
    setSaving(true)
    await supabase.from('trips').insert({
      household_id: household.id,
      name: name.trim(),
      start_date: startDate || null,
      end_date: endDate || null,
      budget: budget || null,
    })
    setName('')
    setStartDate('')
    setEndDate('')
    setBudget('')
    setShowForm(false)
    setSaving(false)
    loadTrips()
  }

  return (
    <Layout title="Trips">
      <button
        type="button"
        onClick={() => setShowForm((v) => !v)}
        className="mb-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-slate-950"
      >
        {showForm ? 'Cancel' : '+ New trip'}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <input
            type="text"
            required
            placeholder="Trip name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-sm"
            />
          </div>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Budget (optional)"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-emerald-500 py-2 text-sm font-semibold text-slate-950"
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
                className="block rounded-xl border border-slate-800 bg-slate-900 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t.name}</span>
                  <span className="font-semibold">{formatCurrency(spent)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {t.start_date ?? '—'} to {t.end_date ?? '—'}
                  {t.budget ? ` · budget ${formatCurrency(t.budget)}` : ''}
                </p>
              </Link>
            </li>
          )
        })}
        {trips.length === 0 && <p className="text-sm text-slate-500">No trips yet.</p>}
      </ul>
    </Layout>
  )
}
