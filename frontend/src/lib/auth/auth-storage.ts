import type { AuthTokens, AuthUser } from "@/types/auth"
import { isUserRole } from "@/lib/auth/roles"

const ACCESS_TOKEN_KEY = "ijms.accessToken"
const REFRESH_TOKEN_KEY = "ijms.refreshToken"
const CURRENT_USER_KEY = "ijms.currentUser"
const AUTH_STORAGE_EVENT = "ijms-auth-storage"

function isBrowser() {
  return typeof window !== "undefined"
}

function readStorageValue(key: string) {
  if (!isBrowser()) {
    return null
  }

  return window.localStorage.getItem(key)
}

function writeStorageValue(key: string, value: string) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.setItem(key, value)
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT))
}

function removeStorageValue(key: string) {
  if (!isBrowser()) {
    return
  }

  window.localStorage.removeItem(key)
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) {
    return false
  }

  const { id, email, fullName, roles } = value

  return (
    (typeof id === "string" || typeof id === "number") &&
    typeof email === "string" &&
    (fullName === undefined || typeof fullName === "string") &&
    Array.isArray(roles) &&
    roles.every(isUserRole)
  )
}

export function getAccessToken() {
  return readStorageValue(ACCESS_TOKEN_KEY)
}

export function getRefreshToken() {
  return readStorageValue(REFRESH_TOKEN_KEY)
}

export function setAuthTokens(tokens: AuthTokens) {
  writeStorageValue(ACCESS_TOKEN_KEY, tokens.accessToken)

  if (tokens.refreshToken) {
    writeStorageValue(REFRESH_TOKEN_KEY, tokens.refreshToken)
  }
}

export function parseStoredCurrentUser(storedUser: string | null) {
  if (!storedUser) {
    return null
  }

  try {
    const parsedUser: unknown = JSON.parse(storedUser)
    return isAuthUser(parsedUser) ? parsedUser : null
  } catch {
    return null
  }
}

export function getCurrentUserStorageValue() {
  return readStorageValue(CURRENT_USER_KEY)
}

export function getCurrentUser() {
  return parseStoredCurrentUser(getCurrentUserStorageValue())
}

export function setCurrentUser(user: AuthUser) {
  writeStorageValue(CURRENT_USER_KEY, JSON.stringify(user))
}

export function clearAuthData() {
  removeStorageValue(ACCESS_TOKEN_KEY)
  removeStorageValue(REFRESH_TOKEN_KEY)
  removeStorageValue(CURRENT_USER_KEY)
}

export function subscribeToAuthStorage(onStoreChange: () => void) {
  if (!isBrowser()) {
    return () => undefined
  }

  window.addEventListener("storage", onStoreChange)
  window.addEventListener(AUTH_STORAGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(AUTH_STORAGE_EVENT, onStoreChange)
  }
}
