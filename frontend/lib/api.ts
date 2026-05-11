const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const TOKEN_KEY = 'socratic_token'

export interface AuthUser {
  id: number
  email: string
  display_name: string
}

export function getToken() {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken()
  const headers = new Headers(options.headers)
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(`${API}${path}`, { ...options, headers })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(detail || 'Request failed')
  }
  return res.json()
}

export async function register(email: string, password: string, displayName: string) {
  const data = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, display_name: displayName }),
  })
  setToken(data.token)
  return data
}

export async function login(email: string, password: string) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.token)
  return data
}

export async function getMe(): Promise<AuthUser> {
  return request('/auth/me')
}

export async function uploadAttachment(file: File) {
  const form = new FormData()
  form.append('file', file)
  return request('/attachments', { method: 'POST', body: form })
}

export async function startSession(topic: string, goal: string) {
  return request('/session/start', {
    method: 'POST',
    body: JSON.stringify({ topic, goal }),
  })
}

export async function submitAnswer(sessionId: string, answer: string, attachmentIds: number[] = []) {
  return request('/session/answer', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, answer, attachment_ids: attachmentIds }),
  })
}

export async function getSession(sessionId: string) {
  return request(`/session/${sessionId}`)
}

export async function getSessions() {
  try {
    return await request('/sessions')
  } catch {
    return []
  }
}
