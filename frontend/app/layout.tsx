import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Socratic — Know what you know',
  description: 'A Socratic tutor that maps your knowledge graph in real time. Never gives answers. Only asks questions.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="relative min-h-screen">
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  )
}
