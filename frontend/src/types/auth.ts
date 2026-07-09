import type { UserRole } from "@/types/roles"

export interface AuthUser {
  id: string | number
  email: string
  fullName?: string
  roles: UserRole[]
}

export interface AuthTokens {
  accessToken: string
  refreshToken?: string
}

export interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  currentUser: AuthUser | null
}
