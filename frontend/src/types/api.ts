export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface PaginatedApiResponse<TItem> {
  count: number
  next: string | null
  previous: string | null
  results: TItem[]
}

export interface ApiErrorResponse {
  message: string
  status?: number
  code?: string
  details?: unknown
}
