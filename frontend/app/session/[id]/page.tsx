'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from '@/lib/useSession'
import { submitAnswer, getSession, uploadAttachment } from '@/lib/api'
import KnowledgeGraph from '@/components/graph/KnowledgeGraph'
import QuestionDisplay from '@/components/ui/QuestionDisplay'
import AnswerInput from '@/components/ui/AnswerInput'
import AssessmentFeedback from '@/components/ui/AssessmentFeedback'
import ChatBubble from '@/components/chat/ChatBubble'

function SessionInner() {
  const params = useParams()
  const router = useRouter()
  const sessionId = params?.id as string
  const {
    sessionId: storeId,
    topic, currentQuestion, history, nodes, edges,
    setSession, setQuestion, setGraph, addTurn,
    answering, setAnswering,
  } = useSession()

  const [lastAssessment, setLastAssessment] = useState<any>(null)
  const [lastAnswer, setLastAnswer] = useState('')
  const [showAssessment, setShowAssessment] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // If page is loaded directly (no store), fetch from API
  useEffect(() => {
    if (!sessionId) return
    if (storeId === sessionId) { setHydrated(true); return }

    getSession(sessionId).then(data => {
      setSession(data.session_id, data.topic, data.goal || '')
      setQuestion(data.current_question || '')
      setGraph(data.graph.nodes, data.graph.edges)
      setHydrated(true)
    }).catch(() => router.push('/'))
  }, [sessionId])

  const handleAnswer = async (answer: string, file?: File | null) => {
    if (!sessionId || !answer.trim()) return
    setAnswering(true)
    setShowAssessment(false)
    setLastAnswer(answer)

    try {
      const attachmentIds: number[] = []
      if (file) {
        const uploaded = await uploadAttachment(file)
        attachmentIds.push(uploaded.id)
      }
      const data = await submitAnswer(sessionId, answer, attachmentIds)

      // Add completed turn to history
      addTurn({
        question: currentQuestion,
        answer,
        assessment: data.assessment,
        turn_index: history.length,
      })

      setLastAssessment(data.assessment)
      setShowAssessment(true)
      setQuestion(data.question)
      setGraph(data.graph.nodes, data.graph.edges)

      // Hide assessment after 4s
      setTimeout(() => setShowAssessment(false), 4000)
    } catch (e: any) {
      console.error(e)
    } finally {
      setAnswering(false)
    }
  }

  const masteredCount = nodes.filter(n => n.state === 'mastered').length
  const confidentCount = nodes.filter(n => n.state === 'confident').length
  const shakingCount = nodes.filter(n => n.state === 'shaky').length
  const unknownCount = nodes.filter(n => n.state === 'unknown' || n.state === 'inferred').length
  const totalKnown = masteredCount + confidentCount

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border border-ion/30 border-t-ion rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ height: '100vh' }}>

      {/* ── Left: Conversation pane ───────────────────────────────────── */}
      <div className="w-full lg:w-2/5 flex flex-col relative z-10 border-r border-white/[0.04]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.04]">
          <div>
            <a href="/" className="font-mono text-xs text-white/20 hover:text-white/40 transition-colors">
              ← socratic
            </a>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs text-white/30">{topic}</p>
            <p className="font-mono text-[10px] text-white/15">
              {history.filter(t => t.answer).length} questions answered
            </p>
          </div>
        </div>

        {/* Conversation history */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {history.filter(t => t.answer).slice(-5).map((turn, i) => (
            <div key={i} className="space-y-2">
              <ChatBubble role="tutor" muted>
                <p className="font-serif italic text-sm leading-relaxed">{turn.question}</p>
              </ChatBubble>
              <ChatBubble role="user" muted>
                <p className="text-sm font-light">{turn.answer}</p>
              </ChatBubble>
            </div>
          ))}
        </div>

        {/* Active question + input */}
        <div className="px-6 pb-6 pt-4 border-t border-white/[0.04]">
          {currentQuestion && (
            <>
              <QuestionDisplay
                question={currentQuestion}
                turnIndex={history.filter(t => t.answer).length}
              />

              <div className="mt-5">
                <AnswerInput
                  onSubmit={handleAnswer}
                  disabled={answering}
                  loading={answering}
                />
              </div>

              {showAssessment && lastAssessment && (
                <AssessmentFeedback
                  assessment={lastAssessment}
                  answer={lastAnswer}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Right: Knowledge graph ────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 relative overflow-hidden">

        {/* Graph stats bar */}
        <div className="flex items-center gap-6 px-6 py-3 border-b border-white/[0.04]">
          <p className="font-mono text-xs text-white/20 uppercase tracking-widest mr-2">Knowledge map</p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-ion/70" />
            <span className="font-mono text-[10px] text-white/30">{totalKnown} known</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400/60" />
            <span className="font-mono text-[10px] text-white/30">{shakingCount} shaky</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-white/10" />
            <span className="font-mono text-[10px] text-white/30">{unknownCount} unknown</span>
          </div>
          {nodes.length > 0 && (
            <div className="ml-auto">
              <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-ion rounded-full transition-all duration-700"
                  style={{ width: `${nodes.length > 0 ? Math.round((totalKnown / nodes.length) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Graph canvas — fills remaining space */}
        <div className="flex-1 relative">
          <KnowledgeGraph
            className="absolute inset-0"
            width={800}
            height={600}
          />
        </div>
      </div>

      {/* Mobile: mini graph strip at top */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-32 z-0 opacity-30 pointer-events-none">
        <KnowledgeGraph width={400} height={130} />
      </div>
    </div>
  )
}

export default function SessionPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-5 h-5 border border-ion/30 border-t-ion rounded-full animate-spin" />
      </div>
    }>
      <SessionInner />
    </Suspense>
  )
}
