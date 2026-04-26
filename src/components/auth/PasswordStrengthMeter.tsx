import { Check } from "lucide-react";
import { PASSWORD_MIN_LENGTH, scorePassword } from "@/lib/passwordStrength";

type Props = {
  password: string;
};

const BAR_COLORS = [
  "bg-border",
  "bg-accent",
  "bg-amber-500",
  "bg-lime-500",
  "bg-emerald-500",
] as const;

export function PasswordStrengthMeter({ password }: Props) {
  if (!password) {
    return (
      <p className="text-xs text-muted-foreground">
        At least {PASSWORD_MIN_LENGTH} characters
      </p>
    );
  }

  const { score, label, meetsMinLength } = scorePassword(password);
  const filledColor = BAR_COLORS[score];

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              score >= i ? filledColor : "bg-border"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-xs">
        <span
          className={`flex items-center gap-1 ${
            meetsMinLength ? "text-muted-foreground" : "text-accent"
          }`}
        >
          {meetsMinLength && <Check className="h-3 w-3" />}
          At least {PASSWORD_MIN_LENGTH} characters
        </span>
        {meetsMinLength && (
          <span className="text-muted-foreground">{label}</span>
        )}
      </div>
    </div>
  );
}
