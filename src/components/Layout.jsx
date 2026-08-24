import BottomNav from './BottomNav'

export default function Layout({ title, children }) {
  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      {title && (
        <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95 px-4 py-3 pt-[env(safe-area-inset-top)] backdrop-blur">
          <h1 className="mx-auto max-w-md text-lg font-semibold">{title}</h1>
        </header>
      )}
      <main className="mx-auto max-w-md px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
    </div>
  )
}
