import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', icon: '🏠', end: true },
  { to: '/trips', label: 'Trips', icon: '✈️' },
  { to: '/add', label: 'Add', icon: '➕' },
  { to: '/charts', label: 'Charts', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-800 bg-slate-950/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {links.map((link) => (
          <li key={link.to} className="flex-1">
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
                  isActive ? 'text-emerald-400' : 'text-slate-500'
                }`
              }
            >
              <span className="text-lg leading-none">{link.icon}</span>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
