import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatsCardProps = {
  title: string;
  description?: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  className?: string;
};

export function StatsCard({
  title,
  description,
  value,
  icon,
  trend,
  className,
}: StatsCardProps) {
  return (
    <div className={cn("", className)}>
      <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <CardHeader className="relative z-10 flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="font-medium text-sm">{title}</CardTitle>
          <div className="text-primary/60 transition-colors duration-300 group-hover:text-primary">
            {icon}
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="font-bold text-2xl">{value}</div>
          {description && (
            <p className="mt-1 text-muted-foreground text-xs">{description}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center">
              <span
                className={cn(
                  "font-medium text-xs",
                  trend.value >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.value >= 0 ? "+" : ""}
                {trend.value}%
              </span>
              <span className="ml-1 text-muted-foreground text-xs">
                {trend.label}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
