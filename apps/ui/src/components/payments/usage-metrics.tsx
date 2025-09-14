// import { getUsagePercentage, isUsageNearLimit } from "@nvn/payments/client";
import type { CustomerMeter, MembershipTierConfig } from "@nvn/payments/types";
import {
  AlertCircle,
  ArrowUpRight,
  Database,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type UsageMetricsProps = {
  meters?: CustomerMeter[];
  tierConfig: MembershipTierConfig;
  onUpgrade?: () => void;
  className?: string;
};

type UsageItemProps = {
  label: string;
  current: number;
  limit: number;
  icon: React.ComponentType<{ className?: string }>;
  unit?: string;
  warningThreshold?: number;
};

const usageIcons = {
  users: Users,
  storage: Database,
  apiCalls: Zap,
  organizations: TrendingUp,
  teams: Users,
} as const;

function UsageItem({
  label,
  current,
  limit,
  icon: Icon,
  unit = "",
  warningThreshold = 80,
}: UsageItemProps) {
  const percentage = limit === -1 ? 0 : Math.min((current / limit) * 100, 100);
  const isNearLimit = limit !== -1 && percentage >= warningThreshold;
  const isOverLimit = limit !== -1 && current > limit;

  // Helper function for formatting (currently inline)
  // const formatValue = (value: number, key: string) => {
  //   if (value === -1) return "Unlimited";
  //   if (key === "storage") return `${value}GB`;
  //   if (key === "apiCalls") return value.toLocaleString();
  //   return value.toString();
  // };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">{label}</span>
        </div>
        <div className="text-right">
          <div className="font-medium text-sm">
            {current.toLocaleString()}
            {unit} / {limit === -1 ? "∞" : `${limit.toLocaleString()}${unit}`}
          </div>
          {limit !== -1 && (
            <div className="text-muted-foreground text-xs">
              {percentage.toFixed(0)}% used
            </div>
          )}
        </div>
      </div>

      {limit !== -1 && (
        <div className="space-y-2">
          <Progress
            className={cn(
              "h-2",
              isOverLimit && "bg-destructive/20",
              isNearLimit &&
                !isOverLimit &&
                "bg-yellow-100 dark:bg-yellow-900/20"
            )}
            value={percentage}
          />

          {(isNearLimit || isOverLimit) && (
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs",
                isOverLimit
                  ? "text-destructive"
                  : "text-yellow-600 dark:text-yellow-400"
              )}
            >
              <AlertCircle className="h-3 w-3" />
              {isOverLimit ? "Usage limit exceeded" : "Approaching usage limit"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function UsageMetrics({
  meters = [],
  tierConfig,
  onUpgrade,
  className,
}: UsageMetricsProps) {
  // Mock current usage data based on meters or use defaults
  const getCurrentUsage = (key: string) => {
    const meter = meters.find((m: any) => m.id?.includes(key));
    return (meter as any)?.consumedUnits || 0;
  };

  const usageData = Object.entries(tierConfig.limits || {}).map(
    ([key, limit]) => ({
      key,
      label:
        key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1"),
      current: getCurrentUsage(key),
      limit,
      icon: usageIcons[key as keyof typeof usageIcons] || Database,
      unit: key === "storage" ? " GB" : key === "apiCalls" ? "" : "",
    })
  );

  const hasNearLimitUsage = usageData.some(
    (item) => item.limit !== -1 && (item.current / item.limit) * 100 >= 80
  );

  const hasOverLimitUsage = usageData.some(
    (item) => item.limit !== -1 && item.current > item.limit
  );

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Usage Metrics</CardTitle>
          {tierConfig.id !== "enterprise" &&
            (hasNearLimitUsage || hasOverLimitUsage) && (
              <Badge
                className="text-xs"
                variant={hasOverLimitUsage ? "destructive" : "secondary"}
              >
                {hasOverLimitUsage ? "Limit Exceeded" : "Near Limit"}
              </Badge>
            )}
        </div>
        <CardDescription>
          Current usage for your {tierConfig.name} plan
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          {usageData.map((item) => (
            <UsageItem
              current={item.current}
              icon={item.icon}
              key={item.key}
              label={item.label}
              limit={item.limit}
              unit={item.unit}
            />
          ))}
        </div>

        {tierConfig.id !== "enterprise" &&
          (hasNearLimitUsage || hasOverLimitUsage) &&
          onUpgrade && (
            <div
              className={cn(
                "rounded-lg border p-4",
                hasOverLimitUsage
                  ? "border-destructive/20 bg-destructive/5"
                  : "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-medium text-sm">
                    {hasOverLimitUsage
                      ? "Usage limits exceeded"
                      : "Approaching usage limits"}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {hasOverLimitUsage
                      ? "Upgrade your plan to restore full functionality"
                      : "Consider upgrading to avoid service interruption"}
                  </div>
                </div>
                <Button
                  className="shrink-0"
                  onClick={onUpgrade}
                  size="sm"
                  variant={hasOverLimitUsage ? "default" : "outline"}
                >
                  Upgrade Plan
                  <ArrowUpRight className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </div>
          )}

        {tierConfig.id === "enterprise" && (
          <div className="rounded-lg border border-muted bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Database className="h-4 w-4" />
              <span>
                Enterprise plan includes unlimited usage across all metrics
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
