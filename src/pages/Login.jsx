import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setSubmitting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-orange-50 px-6 text-stone-800">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-3xl border border-pink-100 bg-white p-6 shadow-lg shadow-pink-100">
        <h1 className="font-heading text-center text-2xl font-bold text-stone-800">
          🐷 Budget Tracker
        </h1>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-stone-500" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-pink-200 bg-white px-3 py-2.5 text-base text-stone-800 outline-none focus:border-pink-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-semibold text-stone-500" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-pink-200 bg-white px-3 py-2.5 text-base text-stone-800 outline-none focus:border-pink-400"
          />
        </div>
        {error && <p className="text-sm font-semibold text-rose-500">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-pink-500 py-2.5 font-bold text-white shadow-md shadow-pink-200 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
