'use client'

import { useState } from 'react'
import { LockKeyhole, LogIn, UserPlus } from 'lucide-react'
import { login, register } from '@/lib/api'

interface Props {
  onAuthenticated: () => void
}

export default function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, displayName || email.split('@')[0])
      }
      onAuthenticated()
    } catch (e: any) {
      setError(e.message || 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md animate-slide-up">
      <div className="landify-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="icon-shell">
            <LockKeyhole size={17} />
          </div>
          <div>
            <p className="font-mono text-xs text-white/35 uppercase tracking-widest">Account</p>
            <h2 className="text-xl font-serif text-white/85">Sign in to ask questions</h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          <button className={`segmented ${mode === 'login' ? 'segmented-active' : ''}`} onClick={() => setMode('login')}>
            <LogIn size={14} /> Login
          </button>
          <button className={`segmented ${mode === 'register' ? 'segmented-active' : ''}`} onClick={() => setMode('register')}>
            <UserPlus size={14} /> Register
          </button>
        </div>

        <div className="space-y-3">
          {mode === 'register' && (
            <input className="field" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display name" />
          )}
          <input className="field" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" />
          <input
            className="field"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Password"
            type="password"
          />
        </div>

        {error && <p className="text-red-300/75 font-mono text-xs mt-4">{error}</p>}

        <button onClick={submit} disabled={loading || !email || password.length < 8} className="btn-submit w-full py-3 mt-5">
          {loading ? 'checking...' : mode === 'login' ? 'login' : 'create account'}
        </button>
      </div>
    </div>
  )
}
