const KEY = "email-just-confirmed";
const TTL_MS = 30_000;

export function markEmailJustConfirmed(): void {
  localStorage.setItem(KEY, String(Date.now()));
}

export function consumeJustConfirmed(): boolean {
  const ts = localStorage.getItem(KEY);
  if (!ts) return false;
  const age = Date.now() - Number(ts);
  if (Number.isNaN(age) || age > TTL_MS) {
    localStorage.removeItem(KEY);
    return false;
  }
  return true;
}

export function clearJustConfirmedSoon(): () => void {
  const t = setTimeout(() => localStorage.removeItem(KEY), TTL_MS);
  return () => clearTimeout(t);
}
