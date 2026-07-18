// The API's uniform error body: { error, message }.
export interface ApiErrorBody {
  error: string
  message: string
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export class NeighborhoodNotFound extends ApiError {
  constructor(message = 'Unknown neighborhood') {
    super(404, 'neighborhood_not_found', message)
    this.name = 'NeighborhoodNotFound'
  }
}

export function parseApiErrorBody(body: unknown): ApiErrorBody | null {
  if (
    body &&
    typeof body === 'object' &&
    typeof (body as { error?: unknown }).error === 'string' &&
    typeof (body as { message?: unknown }).message === 'string'
  ) {
    return body as ApiErrorBody
  }
  return null
}
