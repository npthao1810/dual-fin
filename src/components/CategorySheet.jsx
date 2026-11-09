import { useState } from 'react'
import BottomSheet from './BottomSheet'
import { categoryIcon } from '../lib/categoryIcons'
import { normalize } from '../lib/categoryStats'

function CategoryGrid({ items, selectedId, onPick }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onPick(c.id)}
          className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center ${
            selectedId === c.id ? 'border-pink-400 bg-pink-100 text-pink-600' : 'border-stone-200 bg-white text-stone-600'
          }`}
        >
          <span className="text-2xl leading-none">{categoryIcon(c)}</span>
          <span className="w-full truncate text-xs font-semibold">{c.name}</span>
        </button>
      ))}
    </div>
  )
}

// Mounted only while the sheet is open, so the search box resets every time.
function CategoryPicker({ categories, rankedIds, selectedId, onSelect, onClose }) {
  const [query, setQuery] = useState('')
  const q = normalize(query)

  function pick(id) {
    onSelect(id)
    onClose()
  }

  const matches = q ? categories.filter((c) => normalize(c.name).includes(q)) : null
  const frequent = rankedIds.map((id) => categories.find((c) => c.id === id)).filter(Boolean).slice(0, 6)
  const alphabetical = [...categories].sort((a, b) => a.name.localeCompare(b.name, 'vi'))

  return (
    <>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search categories…"
        aria-label="Search categories"
        className="mb-3 w-full rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300"
      />
      {matches ? (
        matches.length > 0 ? (
          <CategoryGrid items={matches} selectedId={selectedId} onPick={pick} />
        ) : (
          <p className="py-6 text-center text-sm text-stone-400">No category matches “{query}”.</p>
        )
      ) : (
        <>
          {frequent.length > 0 && (
            <>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Frequent</p>
              <div className="mb-4">
                <CategoryGrid items={frequent} selectedId={selectedId} onPick={pick} />
              </div>
            </>
          )}
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">All</p>
          <CategoryGrid items={alphabetical} selectedId={selectedId} onPick={pick} />
        </>
      )}
      {selectedId && (
        <button
          type="button"
          onClick={() => pick('')}
          className="mt-4 w-full rounded-full border border-stone-200 py-2 text-sm font-bold text-stone-500"
        >
          No category
        </button>
      )}
    </>
  )
}

export default function CategorySheet({ open, onClose, ...pickerProps }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Category">
      <CategoryPicker {...pickerProps} onClose={onClose} />
    </BottomSheet>
  )
}
