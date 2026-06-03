import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number;
  className?: string;
  size?: "sm" | "md";
}

export function ProgressBar({ value, className, size = "md" }: ProgressBarProps) {
  const getColor = () => {
    if (value >= 75) return "bg-primary";
    if (value >= 40) return "bg-dept-solucoes";
    return "bg-destructive";
  };

  return (
    <div className={cn("w-full rounded-full bg-muted overflow-hidden", size === "sm" ? "h-1.5" : "h-2", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", getColor())}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
