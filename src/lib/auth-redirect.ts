const DEFAULT_AUTH_REDIRECT = "/";
const SAFE_REDIRECT_ORIGIN = "http://q-chess.local";

export function getSafeAuthRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_REDIRECT,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(value, SAFE_REDIRECT_ORIGIN);
    if (url.origin !== SAFE_REDIRECT_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
