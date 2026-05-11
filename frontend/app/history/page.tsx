'use client'
import { useEffect, useState } from 'react'
import { getSessions } from '@/lib/api'

interface SessionMeta {
  session_id: string
  topic: string
  status: string
  turn_count: number
  created_at: string
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<SessionMeta[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSessions().then(d => { setSessions(d); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen px-5 py-12 max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <a href="/" className="font-mono text-xs text-white/20 hover:text-white/40 transition-colors block mb-2">
            ← home
          </a>
          <h1 className="font-serif text-2xl text-white/80">Past sessions</h1>
        </div>
        <a href="/" className="btn-ghost">New session</a>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 glass rounded-xl animate-pulse-slow" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <p className="text-white/25 mb-4 font-serif italic">No sessions yet.</p>
          <a href="/" className="btn-submit inline-block">Start exploring →</a>
        </div>
      ) : (
        <div className="space-y-2">
          {sessions.map(session => (
            <a
              key={session.session_id}
              href={`/session/${session.session_id}`}
              className="glass-hover rounded-xl p-4 flex items-center gap-4 block transition-all hover:-translate-y-px"
            >
              <div className="w-2 h-2 rounded-full bg-ion/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-serif italic text-white/70 text-sm truncate">{session.topic}</p>
                <p className="font-mono text-[10px] text-white/20 mt-0.5">
                  {session.turn_count} questions ·{' '}
                  {new Date(session.created_at).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <a
                  href={`/graph/${session.session_id}`}
                  onClick={e => e.stopPropagation()}
                  className="font-mono text-[10px] text-white/20 hover:text-white/50 border border-white/5 hover:border-white/15 px-2 py-1 rounded transition-colors"
                >
                  graph
                </a>
                <span className="font-mono text-[10px] text-ion/40 border border-ion/15 px-2 py-1 rounded">
                  continue →
                </span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
