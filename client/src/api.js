const API_BASE = '/api'

export async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })

  const data = response.status === 204 ? null : await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(data?.error || 'The request could not be completed.')
    error.status = response.status
    throw error
  }
  return data
}

export function toList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}
