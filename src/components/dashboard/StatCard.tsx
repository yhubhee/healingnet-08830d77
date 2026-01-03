import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "primary" | "success" | "warning" | "danger" | "info";
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

const variantStyles = {
  primary: "gradient-primary",
  success: "gradient-success",
  warning: "gradient-warning",
  danger: "gradient-danger",
  info: "gradient-info",
};

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "primary",
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 text-foreground card-hover",
        variantStyles[variant],
        className
      )}
      style={{ animationDelay: "0.1s" }}
    >
      {/* Background icon */}
      <Icon className="stat-card-icon" />

      {/* Content */}
      <div className="relative z-10">
        <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
        <h3 className="text-3xl font-heading font-bold mb-1">{value}</h3>
        {subtitle && (
          <p className="text-sm opacity-70">{subtitle}</p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <span
              className={cn(
                "text-sm font-medium",
                trend.isPositive ? "text-green-300" : "text-red-300"
              )}
            >
              {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
            </span>
            <span className="text-sm opacity-60">vs last month</span>
          </div>
        )}
      </div>
    </div>
  );
}
