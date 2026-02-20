import { fetchAuthSession } from 'aws-amplify/auth'

// Base URL for API requests (remove trailing slash)
const API_BASE_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

async function getAuthToken(): Promise<string | undefined> {
  try {
    const session = await fetchAuthSession()
    return session.tokens?.idToken?.toString()
  } catch {
    return undefined
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`
  const token = await getAuthToken()

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }

  return response.json()
}
