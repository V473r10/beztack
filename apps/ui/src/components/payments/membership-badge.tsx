import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, Building2, Sparkles } from "lucide-react";
import { getTierConfig } from "@nvn/payments/constants";
import type { MembershipTier } from "@nvn/payments/types";

export interface MembershipBadgeProps {
  tier: MembershipTier;
  variant?: "default" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

const tierIcons = {
  free: Sparkles,
  pro: Crown,
  team: Users,
  enterprise: Building2,
};

const tierColors = {
  free: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200",
  pro: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 border-purple-200",
  team: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400 border-green-200",
  enterprise: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400 border-orange-200",
};

export function MembershipBadge({
  tier,
  variant = "default",
  size = "md",
  showIcon = true,
  className,
}: MembershipBadgeProps) {
  const tierConfig = getTierConfig(tier);
  const Icon = tierIcons[tier];
  
  if (!tierConfig) {
    return null;
  }

  const sizeClasses = {
    sm: "h-5 px-2 text-xs",
    md: "h-6 px-2.5 text-sm",
    lg: "h-7 px-3 text-sm",
  };

  const iconSizes = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const customStyle = variant === "default" ? tierColors[tier] : "";

  return (
    <Badge
      variant={variant}
      className={cn(
        sizeClasses[size],
        customStyle,
        "inline-flex items-center gap-1.5 font-medium",
        className
      )}
    >
      {showIcon && Icon && (
        <Icon className={iconSizes[size]} />
      )}
      {tierConfig.name}
    </Badge>
  );
}

export interface MembershipStatusProps {
  tier: MembershipTier;
  isActive: boolean;
  expiresAt?: Date;
  className?: string;
}

export function MembershipStatus({
  tier,
  isActive,
  expiresAt,
  className,
}: MembershipStatusProps) {
  const tierConfig = getTierConfig(tier);
  
  if (!tierConfig) {
    return null;
  }

  const getStatusColor = () => {
    if (!isActive) return "destructive";
    if (expiresAt && expiresAt < new Date()) return "destructive";
    if (tier === "free") return "secondary";
    return "default";
  };

  const getStatusText = () => {
    if (!isActive) return "Inactive";
    if (expiresAt && expiresAt < new Date()) return "Expired";
    return "Active";
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <MembershipBadge tier={tier} />
      <Badge variant={getStatusColor() as any} className="h-5 px-2 text-xs">
        {getStatusText()}
      </Badge>
      {expiresAt && isActive && expiresAt > new Date() && (
        <span className="text-xs text-muted-foreground">
          Renews {expiresAt.toLocaleDateString()}
        </span>
      )}
    </div>
  );
}