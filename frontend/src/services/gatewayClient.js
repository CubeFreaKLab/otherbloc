const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export async function gatewayRequest(path, options = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`Gateway request failed with status ${response.status}`)
  }

  return response.json()
}
