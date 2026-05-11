'use client'
import { useEffect, useState } from 'react'

interface Props {
  question: string
  turnIndex: number
}

export default function QuestionDisplay({ question, turnIndex }: Props) {
  const [displayed, setDisplayed] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    setDisplayed('')
    setDone(false)
    if (!question) return

    let i = 0
    const interval = setInterval(() => {
      if (i < question.length) {
        setDisplayed(question.slice(0, i + 1))
        i++
      } else {
        setDone(true)
        clearInterval(interval)
      }
    }, 18) // ~18ms per char — fast but visible

    return () => clearInterval(interval)
  }, [question])

  return (
    <div className="animate-slide-up">
      {turnIndex > 0 && (
        <p className="font-mono text-xs text-white/20 uppercase tracking-widest mb-4">
          Question {turnIndex + 1}
        </p>
      )}
      <p className={`question-text ${!done ? 'typing-cursor' : ''}`}>
        {displayed || '\u00A0'}
      </p>
    </div>
  )
}
