'use client'
import { useEffect, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/lib/useSession'
import { getSession } from '@/lib/api'
import KnowledgeGraph from '@/components/graph/KnowledgeGraph'

const STATE_LABELS: Record<string, string> = {
  unknown:   'Not yet probed',
  inferred:  'Mentioned, unconfirmed',
  shaky:     'Partial understanding',
  confident: 'Solid grasp',
  mastered:  'Deep understanding',
}

function GraphInner() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id as string
  const { nodes, edges, topic, setSession, setQuestion, setGraph, highlightedNode } = useSession()

  useEffect(() => {
    if (!sessionId || nodes.length > 0) return
    getSession(sessionId).then(data => {
      setSession(data.session_id, data.topic, data.goal || '')
      setQuestion(data.current_question || '')
      setGraph(data.graph.nodes, data.graph.edges)
    }).catch(() => router.push('/'))
  }, [sessionId])

  const activeNode = nodes.find(n => n.name === highlightedNode)

  const stateCounts = nodes.reduce((acc, n) => {
    acc[n.state] = (acc[n.state] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04] z-10 relative">
        <div className="flex items-center gap-4">
          <a
            href={`/session/${sessionId}`}
            className="font-mono text-xs text-white/20 hover:text-white/50 transition-colors"
          >
            ← session
          </a>
          <span className="font-mono text-xs text-white/15">|</span>
          <p className="font-mono text-xs text-white/30">{topic} — knowledge map</p>
        </div>
        <div className="flex gap-4">
          {Object.entries(stateCounts).map(([state, count]) => (
            <div key={state} className="text-right hidden sm:block">
              <p className="font-mono text-[10px] text-white/20 uppercase tracking-wider">{state}</p>
              <p className="font-mono text-sm text-white/50">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Graph — full screen */}
      <div className="flex-1 relative">
        <KnowledgeGraph
          className="absolute inset-0 w-full h-full"
          width={1200}
          height={700}
        />
      </div>

      {/* Active node detail panel */}
      {activeNode && (
        <div className="absolute bottom-6 left-6 glass rounded-xl p-4 w-72 z-20 animate-slide-up">
          <div className="flex items-start justify-between mb-2">
            <p className="font-mono text-sm text-white/80 font-medium">{activeNode.name}</p>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded pill-${activeNode.state}`}>
              {activeNode.state}
            </span>
          </div>
          <p className="text-xs text-white/30 mb-2">{STATE_LABELS[activeNode.state]}</p>

          {/* Confidence bar */}
          <div className="mb-2">
            <div className="flex justify-between mb-1">
              <span className="font-mono text-[10px] text-white/20">Confidence</span>
              <span className="font-mono text-[10px] text-white/40">
                {Math.round(activeNode.confidence * 100)}%
              </span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${activeNode.confidence * 100}%`,
                  background: activeNode.state === 'mastered' ? '#6366f1'
                    : activeNode.state === 'confident' ? '#2563eb'
                    : activeNode.state === 'shaky' ? '#d97706'
                    : '#0e7490',
                }}
              />
            </div>
          </div>

          {activeNode.evidence && (
            <p className="text-[10px] text-white/25 italic leading-snug border-t border-white/5 pt-2">
              Evidence: "{activeNode.evidence.slice(0, 100)}"
            </p>
          )}
        </div>
      )}

      {/* Instruction hint */}
      {!activeNode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass rounded-lg px-4 py-2">
          <p className="font-mono text-xs text-white/20">hover nodes to explore</p>
        </div>
      )}
    </div>
  )
}

export default function GraphPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border border-ion/30 border-t-ion rounded-full animate-spin" />
      </div>
    }>
      <GraphInner />
    </Suspense>
  )
}
