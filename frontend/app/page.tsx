'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, MessageCircleQuestion } from 'lucide-react'
import AuthPanel from '@/components/auth/AuthPanel'
import { clearToken, getMe, getToken, startSession, type AuthUser } from '@/lib/api'
import { useSession } from '@/lib/useSession'

const TOPICS = [
  'Backpropagation',
  'Transformer attention',
  'TCP/IP networking',
  'Bayesian inference',
  'React hooks',
  'Kubernetes',
  'Reinforcement learning',
  'Operating system memory',
]

export default function HomePage() {
  const router = useRouter()
  const { setSession, setQuestion, setGraph, setLoading, loading } = useSession()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [topic, setTopic] = useState('')
  const [goal, setGoal] = useState('')
  const [error, setError] = useState('')
  const [step, setStep] = useState<'topic' | 'goal'>('topic')

  const refreshUser = () => {
    if (!getToken()) {
      setCheckingAuth(false)
      return
    }
    getMe()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setCheckingAuth(false))
  }

  useEffect(refreshUser, [])

  const handleTopicNext = () => {
    if (topic.trim()) setStep('goal')
  }

  const handleStart = async () => {
    if (!topic.trim()) return
    setError('')
    setLoading(true)
    try {
      const data = await startSession(topic.trim(), goal.trim())
      setSession(data.session_id, topic.trim(), goal.trim())
      setQuestion(data.question)
      setGraph(data.graph.nodes, data.graph.edges)
      router.push(`/session/${data.session_id}`)
    } catch (e: any) {
      setError(e.message || 'Failed to start')
      setLoading(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border border-ion/30 border-t-ion rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="mb-12 text-center animate-fade-in">
        <div className="inline-flex items-center gap-3 mb-6">
          <div className="icon-shell">
            <MessageCircleQuestion size={18} />
          </div>
          <span className="font-mono text-sm text-white/35 tracking-widest uppercase">Socratic</span>
        </div>

        <h1 className="font-serif text-5xl sm:text-6xl text-white/90 leading-tight mb-4">
          Know what<br />
          <em className="text-ion-bright">you know.</em>
        </h1>

        <p className="text-white/45 text-base max-w-sm mx-auto leading-relaxed font-light">
          A minimalist Socratic tutor with clear question and answer bubbles.
        </p>
      </div>

      {!user ? (
        <AuthPanel onAuthenticated={refreshUser} />
      ) : (
        <div className="w-full max-w-md animate-slide-up">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-xs text-white/30">Signed in as {user.display_name}</p>
            <button
              className="icon-button"
              title="Sign out"
              onClick={() => {
                clearToken()
                setUser(null)
              }}
            >
              <LogOut size={14} />
            </button>
          </div>

          <div className="landify-card p-6">
            {step === 'topic' ? (
              <>
                <label className="label">What do you want to understand?</label>
                <input
                  autoFocus
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTopicNext()}
                  className="field mb-5"
                  placeholder="e.g. transformer attention mechanism"
                />

                <div className="flex flex-wrap gap-2 mb-6">
                  {TOPICS.map(t => (
                    <button key={t} onClick={() => { setTopic(t); setStep('goal') }} className="choice-chip">
                      {t}
                    </button>
                  ))}
                </div>

                <button onClick={handleTopicNext} disabled={!topic.trim()} className="btn-submit w-full py-3">
                  continue
                </button>
              </>
            ) : (
              <>
                <div className="mb-5">
                  <p className="label mb-1">Topic</p>
                  <p className="font-serif italic text-white/75">{topic}</p>
                </div>

                <label className="label">What is your goal?</label>
                <input
                  autoFocus
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStart()}
                  className="field mb-6"
                  placeholder="e.g. understand enough to implement it"
                />

                {error && <p className="text-red-300/75 font-mono text-xs mb-4">{error}</p>}

                <div className="flex gap-2">
                  <button onClick={() => setStep('topic')} className="btn-ghost px-4">
                    back
                  </button>
                  <button onClick={handleStart} disabled={loading} className="btn-submit flex-1 py-2.5">
                    {loading ? 'initialising...' : 'begin session'}
                  </button>
                </div>
              </>
            )}
          </div>

          <a href="/history" className="mt-7 block text-center font-mono text-xs text-white/20 hover:text-white/45 transition-colors">
            past sessions
          </a>
        </div>
      )}
    </main>
  )
}
