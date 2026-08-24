import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import AddExpense from './pages/AddExpense'
import Trips from './pages/Trips'
import TripDetail from './pages/TripDetail'
import Charts from './pages/Charts'
import Settings from './pages/Settings'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/add"
            element={
              <RequireAuth>
                <AddExpense />
              </RequireAuth>
            }
          />
          <Route
            path="/trips"
            element={
              <RequireAuth>
                <Trips />
              </RequireAuth>
            }
          />
          <Route
            path="/trips/:id"
            element={
              <RequireAuth>
                <TripDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/charts"
            element={
              <RequireAuth>
                <Charts />
              </RequireAuth>
            }
          />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <Settings />
              </RequireAuth>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
