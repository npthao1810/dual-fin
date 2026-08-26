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

  const groups = []
  let currentDate = null
  for (const e of expenses) {
    if (e.date !== currentDate) {
      currentDate = e.date
      groups.push({ date: e.date, items: [] })
    }
    groups[groups.length - 1].items.push(e)
  }

  return (
    <Layout title="Activity">
      <ActivityTabs />
      {loading && <p className="text-sm text-stone-400">Loading…</p>}
      {!loading && expenses.length === 0 && (
        <p className="text-sm text-stone-400">No expenses recorded yet.</p>
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
