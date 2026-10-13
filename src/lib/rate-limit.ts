type Entry = { count: number; expiresAt: number };
const attempts = new Map<string, Entry>();

export function checkRateLimit(key: string, limit = 8, windowMs = 15 * 60 * 1000) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.expiresAt <= now) {
    attempts.set(key, { count: 1, expiresAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
