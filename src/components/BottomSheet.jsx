import { useEffect } from 'react'

/** Modal sheet anchored to the bottom of the screen. Renders nothing while closed. */
export default function BottomSheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-stone-900/40" />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h2 className="font-heading text-base font-bold text-stone-800">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm font-bold text-pink-500">
            Done
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4">{children}</div>
      </div>
    </div>
  )
}
