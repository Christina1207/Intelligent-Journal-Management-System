import type { AuthTokens, AuthUser } from "@/types/auth";

const ACCESS_TOKEN_KEY = "ijms.accessToken";
const REFRESH_TOKEN_KEY = "ijms.refreshToken";
const CURRENT_USER_KEY = "ijms.currentUser";
const AUTH_STORAGE_EVENT = "ijms-auth-storage";

function isBrowser() {
  return typeof window !== "undefined";
}

function emitAuthStorageEvent() {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

function readStorageValue(key: string) {
  if (!isBrowser()) return null;
  return window.localStorage.getItem(key);
}

function writeStorageValue(key: string, value: string) {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, value);
  emitAuthStorageEvent();
}

function removeStorageValue(key: string) {
  if (!isBrowser()) return;
  window.localStorage.removeItem(key);
  emitAuthStorageEvent();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!isRecord(value)) return false;

  return (
    typeof value.id === "string" &&
    typeof value.username === "string" &&
    typeof value.email === "string" &&
    typeof value.first_name === "string" &&
    typeof value.last_name === "string" &&
    typeof value.status === "string" &&
    Array.isArray(value.roles) &&
    value.roles.every((role) => typeof role === "string")
  );
}

export function getAccessToken() {
  return readStorageValue(ACCESS_TOKEN_KEY);
}

export function getRefreshToken() {
  return readStorageValue(REFRESH_TOKEN_KEY);
}

export function saveAuthTokens(tokens: AuthTokens) {
  writeStorageValue(ACCESS_TOKEN_KEY, tokens.access);
  writeStorageValue(REFRESH_TOKEN_KEY, tokens.refresh);
}

export function clearAuthTokens() {
  removeStorageValue(ACCESS_TOKEN_KEY);
  removeStorageValue(REFRESH_TOKEN_KEY);
}

export function parseStoredCurrentUser(storedUser: string | null) {
  if (!storedUser) return null;

  try {
    const parsedUser: unknown = JSON.parse(storedUser);
    return isAuthUser(parsedUser) ? parsedUser : null;
  } catch {
    return null;
  }
}

export function getCurrentUserStorageValue() {
  return readStorageValue(CURRENT_USER_KEY);
}

export function getStoredCurrentUser() {
  return parseStoredCurrentUser(getCurrentUserStorageValue());
}

export function saveCurrentUser(user: AuthUser) {
  writeStorageValue(CURRENT_USER_KEY, JSON.stringify(user));
}

export function clearCurrentUser() {
  removeStorageValue(CURRENT_USER_KEY);
}

export function clearAuthData() {
  if (!isBrowser()) return;

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(CURRENT_USER_KEY);
  emitAuthStorageEvent();
}

export function subscribeToAuthStorage(onStoreChange: () => void) {
  if (!isBrowser()) {
    return () => undefined;
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener(AUTH_STORAGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(AUTH_STORAGE_EVENT, onStoreChange);
  };
}
