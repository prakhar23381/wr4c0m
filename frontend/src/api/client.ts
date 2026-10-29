export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type Params = Record<string, string | number | undefined>

export async function getJson<T>(path: string, params: Params = {}): Promise<T> {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value))
  }
  const url = `/api${path}${query.size ? `?${query}` : ''}`
  const response = await fetch(url)
  if (!response.ok) throw new ApiError(response.status, await errorDetail(response))
  return (await response.json()) as T
}

async function errorDetail(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      return body.detail.map((d: { msg?: string }) => d.msg ?? String(d)).join('; ')
    }
  } catch {
    // Not JSON: fall through to the status text.
  }
  return `${response.status} ${response.statusText}`.trim()
}
