import { NavLink } from 'react-router-dom'

export default function ActivityTabs() {
  return (
    <div className="mb-4 flex gap-1 rounded-full border border-pink-100 bg-white p-1 shadow-sm shadow-pink-50">
      <NavLink
        to="/history"
        className={({ isActive }) =>
          `flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-center text-sm font-semibold ${
            isActive ? 'bg-pink-500 text-white' : 'text-stone-500'
          }`
        }
      >
        <img src="/icons/nav/history.png" alt="" className="h-5 w-5" />
        All expenses
      </NavLink>
      <NavLink
        to="/trips"
        className={({ isActive }) =>
          `flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-center text-sm font-semibold ${
            isActive ? 'bg-pink-500 text-white' : 'text-stone-500'
          }`
        }
      >
        <img src="/icons/nav/trips.png" alt="" className="h-5 w-5" />
        Trips
      </NavLink>
    </div>
  )
}
