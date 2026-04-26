const KEY = "email-just-confirmed";
const EMAIL_CHANGE_KEY = "email-just-changed";
const TTL_MS = 30_000;

export { EMAIL_CHANGE_KEY };

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

export function markEmailJustChanged(): void {
  localStorage.setItem(EMAIL_CHANGE_KEY, String(Date.now()));
}

export function consumeEmailJustChanged(): boolean {
  const ts = localStorage.getItem(EMAIL_CHANGE_KEY);
  if (!ts) return false;
  const age = Date.now() - Number(ts);
  if (Number.isNaN(age) || age > TTL_MS) {
    localStorage.removeItem(EMAIL_CHANGE_KEY);
    return false;
  }
  return true;
}

export function clearEmailJustChangedSoon(): () => void {
  const t = setTimeout(() => localStorage.removeItem(EMAIL_CHANGE_KEY), TTL_MS);
  return () => clearTimeout(t);
}
