'use client'

import { useEffect, useRef, useState } from 'react'
import { Paperclip, Send, X } from 'lucide-react'

interface Props {
  onSubmit: (answer: string, file?: File | null) => void
  disabled?: boolean
  loading?: boolean
}

export default function AnswerInput({ onSubmit, disabled, loading }: Props) {
  const [value, setValue] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!disabled && ref.current) ref.current.focus()
  }, [disabled])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || loading) return
    onSubmit(trimmed, file)
    setValue('')
    setFile(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="animate-fade-in">
      <textarea
        ref={ref}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || loading}
        className="answer-input"
        placeholder={loading ? 'Thinking...' : 'Your answer - press Enter to submit, Shift+Enter for new line'}
        rows={3}
      />

      <div className="flex items-center justify-between gap-3 mt-3">
        <div className="flex gap-2 flex-wrap items-center">
          <label className="icon-button" title="Attach a file">
            <Paperclip size={14} />
            <input
              className="hidden"
              type="file"
              disabled={disabled || loading}
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
          </label>
          {['I don\'t know', 'Can you rephrase?', 'I\'m unsure but...'].map(quick => (
            <button
              key={quick}
              onClick={() => { setValue(quick); ref.current?.focus() }}
              disabled={disabled || loading}
              className="text-[11px] font-mono text-white/25 hover:text-white/55 transition-colors border border-white/5 hover:border-white/15 px-2.5 py-1 rounded-md"
            >
              {quick}
            </button>
          ))}
        </div>

        <button onClick={handleSubmit} disabled={!value.trim() || disabled || loading} className="btn-submit">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 border border-ion/30 border-t-ion rounded-full animate-spin" />
              thinking
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Send size={14} /> submit
            </span>
          )}
        </button>
      </div>

      {file && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
          <p className="truncate text-xs font-mono text-white/35">{file.name}</p>
          <button className="icon-button" onClick={() => setFile(null)} title="Remove attachment">
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
