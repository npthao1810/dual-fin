import BottomNav from './BottomNav'
import StatusBanner from './StatusBanner'

export default function Layout({ title, children }) {
  return (
    <div className="min-h-full bg-orange-50 text-stone-800">
      {title && (
        <header className="sticky top-0 z-10 border-b border-pink-100 bg-white/90 pt-[env(safe-area-inset-top)] backdrop-blur">
          <StatusBanner />
          <h1 className="font-heading mx-auto max-w-md px-4 py-3 text-lg font-bold text-stone-800">{title}</h1>
        </header>
      )}
      <main className="mx-auto max-w-md px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
    </div>
  )
}
