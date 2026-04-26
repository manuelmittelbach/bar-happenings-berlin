export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  meetsMinLength: boolean;
};

export const PASSWORD_MIN_LENGTH = 8;

export function scorePassword(pw: string): PasswordStrength {
  const meetsMinLength = pw.length >= PASSWORD_MIN_LENGTH;

  if (!meetsMinLength) {
    return { score: 0, label: "Too short", meetsMinLength: false };
  }

  let points = 0;
  if (pw.length >= 8) points += 1;
  if (pw.length >= 12) points += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) points += 1;
  if (/\d/.test(pw)) points += 1;
  if (/[^A-Za-z0-9]/.test(pw)) points += 1;

  const score = Math.min(4, Math.max(1, points - 1)) as 1 | 2 | 3 | 4;
  const label =
    score === 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";

  return { score, label, meetsMinLength: true };
}
