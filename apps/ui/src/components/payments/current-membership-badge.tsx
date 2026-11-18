import { AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { useMembership } from "@/contexts/membership-context";
import { MembershipBadge, type MembershipBadgeProps } from "./membership-badge";

/**
 * The badge of the caller's current Membership. When the plan could not be
 * loaded it says so; it never falls back to "Free".
 */
export function CurrentMembershipBadge({ size = "md" }: Pick<MembershipBadgeProps, "size">) {
  const { t } = useTranslation();
  const { currentTier, isTierUnknown } = useMembership();

  if (!isTierUnknown) {
    return <MembershipBadge size={size} tier={currentTier} />;
  }

  return (
    <Badge
      className="inline-flex h-5 items-center gap-1.5 px-2 font-medium text-xs"
      variant="outline"
    >
      <AlertCircle className="h-3 w-3" />
      {t("billing.membershipUnavailable.badge")}
    </Badge>
  );
}
