export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-orange-50">
      <div className="relative h-16 w-56 overflow-hidden">
        <img
          src="/icons/nav/anh.png"
          alt=""
          className="duck-run absolute bottom-3 h-10 w-10"
          style={{ animationDelay: '0s, 0s' }}
        />
        <img
          src="/icons/nav/em.png"
          alt=""
          className="duck-run absolute bottom-3 h-10 w-10"
          style={{ animationDelay: '-0.45s, -0.15s' }}
        />
        <div
          className="absolute bottom-0 left-0 h-3 w-full"
          style={{
            backgroundColor: '#a3d977',
            backgroundImage:
              'linear-gradient(45deg, #86c66a 25%, transparent 25%), linear-gradient(-45deg, #86c66a 25%, transparent 25%)',
            backgroundSize: '10px 10px',
          }}
        />
      </div>
      <p className="text-sm font-semibold text-stone-400">chotto matte ✋🏻</p>
    </div>
  )
}
