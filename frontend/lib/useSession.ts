import { create } from 'zustand'

export interface GraphNode {
  name: string
  confidence: number
  state: 'unknown' | 'inferred' | 'shaky' | 'confident' | 'mastered'
  x: number
  y: number
  evidence?: string | null
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
}

export interface Turn {
  question: string
  answer?: string
  assessment?: {
    confidence: number
    correctness: string
    concepts_demonstrated: Array<{ name: string; confidence: number; state: string }>
    follow_up_direction: string
    internal_note: string
  }
  turn_index: number
}

interface SessionState {
  sessionId: string | null
  topic: string
  goal: string
  currentQuestion: string
  history: Turn[]
  nodes: GraphNode[]
  edges: GraphEdge[]
  loading: boolean
  answering: boolean
  highlightedNode: string | null

  setSession: (id: string, topic: string, goal: string) => void
  setQuestion: (q: string) => void
  setGraph: (nodes: GraphNode[], edges: GraphEdge[]) => void
  addTurn: (turn: Turn) => void
  setLoading: (v: boolean) => void
  setAnswering: (v: boolean) => void
  setHighlightedNode: (name: string | null) => void
  reset: () => void
}

export const useSession = create<SessionState>((set) => ({
  sessionId: null,
  topic: '',
  goal: '',
  currentQuestion: '',
  history: [],
  nodes: [],
  edges: [],
  loading: false,
  answering: false,
  highlightedNode: null,

  setSession: (id, topic, goal) => set({ sessionId: id, topic, goal }),
  setQuestion: (q) => set({ currentQuestion: q }),
  setGraph: (nodes, edges) => set({ nodes, edges }),
  addTurn: (turn) => set(s => ({ history: [...s.history, turn] })),
  setLoading: (v) => set({ loading: v }),
  setAnswering: (v) => set({ answering: v }),
  setHighlightedNode: (name) => set({ highlightedNode: name }),
  reset: () => set({
    sessionId: null, topic: '', goal: '', currentQuestion: '',
    history: [], nodes: [], edges: [], loading: false, answering: false, highlightedNode: null,
  }),
}))
