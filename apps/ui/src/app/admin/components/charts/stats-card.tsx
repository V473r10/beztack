import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  description?: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  delay?: number;
  className?: string;
}

export function StatsCard({ 
  title, 
  description, 
  value, 
  icon, 
  trend, 
  delay: _delay = 0,
  className 
}: StatsCardProps) {
  return (
    <div
      className={cn("", className)}
    >
      <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className="text-primary/60 group-hover:text-primary transition-colors duration-300">
            {icon}
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div 
            className="text-2xl font-bold"
            
          >
            {value}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">
              {description}
            </p>
          )}
          {trend && (
            <div className="flex items-center mt-2">
              <span 
                className={cn(
                  "text-xs font-medium",
                  trend.value >= 0 ? "text-green-600" : "text-red-600"
                )}
              >
                {trend.value >= 0 ? "+" : ""}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground ml-1">
                {trend.label}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
