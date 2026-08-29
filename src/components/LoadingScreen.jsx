export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-orange-50">
      <div className="relative h-14 w-56 overflow-hidden">
        <img
          src="/icons/nav/anh.png"
          alt=""
          className="duck-run absolute top-1 h-10 w-10"
          style={{ animationDelay: '0s, 0s' }}
        />
        <img
          src="/icons/nav/em.png"
          alt=""
          className="duck-run absolute top-1 h-10 w-10"
          style={{ animationDelay: '-0.45s, -0.15s' }}
        />
      </div>
      <p className="text-sm font-semibold text-stone-400">cham chi man nhon</p>
    </div>
  )
}
