/** Provider cooldown registry used by route selection after HTTP 429 responses. */
interface ProviderLimit { provider: string; limitedUntil: number; strikes: number; retryAfterMs: number; updatedAt: string }
const limits = new Map<string, ProviderLimit>();

export function recordProviderRateLimit(provider: string, retryAfterMs = 30_000): ProviderLimit {
  const key = provider.trim().toLowerCase(); if (!key) throw new Error("provider 必填");
  const previous = limits.get(key); const strikes = (previous?.strikes ?? 0) + 1;
  const backoff = Math.min(15 * 60_000, Math.max(1000, retryAfterMs) * Math.pow(2, Math.min(4, strikes - 1)));
  const state = { provider: key, limitedUntil: Date.now() + backoff, strikes, retryAfterMs: backoff, updatedAt: new Date().toISOString() };
  limits.set(key, state); return state;
}

export function isProviderAvailable(provider: string): boolean {
  const state = limits.get(provider.trim().toLowerCase());
  if (!state) return true; if (Date.now() >= state.limitedUntil) { limits.delete(state.provider); return true; } return false;
}

export function recordProviderRecovered(provider: string): void { limits.delete(provider.trim().toLowerCase()); }
export function listProviderRateLimits(): Array<ProviderLimit & { remainingMs: number }> {
  return [...limits.values()].filter((state) => !isProviderAvailable(state.provider)).map((state) => ({ ...state, remainingMs: Math.max(0, state.limitedUntil - Date.now()) }));
}
