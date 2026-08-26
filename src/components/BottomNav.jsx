import { Link, useLocation } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', icon: '/icons/nav/home.png', match: (path) => path === '/' },
  {
    to: '/history',
    label: 'Activity',
    icon: '/icons/nav/history.png',
    match: (path) => path.startsWith('/history') || path.startsWith('/trips'),
  },
  { to: '/add', label: 'Add', icon: '/icons/nav/add.png', match: (path) => path.startsWith('/add') || path.startsWith('/edit') },
  { to: '/charts', label: 'Charts', icon: '/icons/nav/charts.png', match: (path) => path.startsWith('/charts') },
  { to: '/settings', label: 'Settings', icon: '/icons/nav/settings.png', match: (path) => path.startsWith('/settings') },
]

export default function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-pink-100 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {links.map((link) => {
          const isActive = link.match(pathname)
          return (
            <li key={link.to} className="flex-1">
              <Link
                to={link.to}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-semibold ${
                  isActive ? 'text-pink-500' : 'text-stone-400'
                }`}
              >
                <img
                  src={link.icon}
                  alt=""
                  className={`h-6 w-6 ${isActive ? '' : 'opacity-40 grayscale'}`}
                />
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
