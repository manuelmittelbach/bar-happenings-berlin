interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClass: Record<NonNullable<SpinnerProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-8 w-8",
};

export function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={`${sizeClass[size]} border-2 border-foreground border-t-transparent rounded-full animate-spin ${className}`}
    />
  );
}
