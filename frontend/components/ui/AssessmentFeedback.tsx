'use client'

interface AssessmentData {
  confidence: number
  correctness: string
  concepts_demonstrated: Array<{ name: string; confidence: number; state: string }>
  reasoning_quality: string
  follow_up_direction: string
  internal_note: string
}

const STATE_PILL: Record<string, string> = {
  unknown:   'pill-unknown',
  inferred:  'pill-inferred',
  shaky:     'pill-shaky',
  confident: 'pill-confident',
  mastered:  'pill-mastered',
}

const CORRECTNESS_LABEL: Record<string, string> = {
  correct:   'Correct',
  partial:   'Partially right',
  incorrect: 'Needs revision',
  unknown:   'Exploring',
  refused:   'Honest — let\'s find your floor',
}

const DIRECTION_NOTE: Record<string, string> = {
  deeper:       'Going deeper into this concept',
  sideways:     'Exploring a related concept',
  prerequisite: 'Building up a foundation first',
  clarify:      'Clarifying your understanding',
}

interface Props {
  assessment: AssessmentData
  answer: string
}

export default function AssessmentFeedback({ assessment, answer }: Props) {
  const demonstrated = assessment.concepts_demonstrated?.filter(c => c.confidence > 0.15) || []

  return (
    <div className="glass rounded-xl p-4 mt-4 animate-fade-in border border-white/5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs font-mono text-white/30 uppercase tracking-wider mb-0.5">Your answer</p>
          <p className="text-sm text-white/50 italic leading-snug">"{answer.slice(0, 120)}{answer.length > 120 ? '...' : ''}"</p>
        </div>
        <div className="text-right shrink-0">
          <span className={`text-xs font-mono px-2 py-1 rounded-md ${
            assessment.correctness === 'correct'   ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50' :
            assessment.correctness === 'incorrect' ? 'bg-red-950/50 text-red-400 border border-red-900/50' :
                                                     'bg-white/5 text-white/30 border border-white/8'
          }`}>
            {CORRECTNESS_LABEL[assessment.correctness] || assessment.correctness}
          </span>
        </div>
      </div>

      {/* Concepts revealed */}
      {demonstrated.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-mono text-white/20 uppercase tracking-wider mb-1.5">Concepts revealed</p>
          <div className="flex flex-wrap gap-1.5">
            {demonstrated.map((c, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-mono ${STATE_PILL[c.state] || STATE_PILL.unknown}`}>
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Next direction */}
      <p className="text-[10px] font-mono text-white/20">
        {DIRECTION_NOTE[assessment.follow_up_direction] || 'Continuing...'}
      </p>
    </div>
  )
}
