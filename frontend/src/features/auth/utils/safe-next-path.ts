export function getSafeNextPath(
  value: string | null | undefined,
  fallback: string | null = null,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

export function withNextPath(path: string, nextPath: string | null) {
  return nextPath ? `${path}?next=${encodeURIComponent(nextPath)}` : path;
}
