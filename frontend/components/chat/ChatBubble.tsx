'use client'

interface Props {
  role: 'user' | 'tutor'
  children: React.ReactNode
  muted?: boolean
}

export default function ChatBubble({ role, children, muted }: Props) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${muted ? 'opacity-55' : ''}`}>
      <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-tutor'}`}>
        {children}
      </div>
    </div>
  )
}
