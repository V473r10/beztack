import { Loader2, ShieldAlert, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMembership } from "@/contexts/membership-context";
import { useActiveOrganization } from "@/hooks/use-organizations";
import { cn } from "@/lib/utils";
import type { MembershipTier } from "@/types/membership";

const tierLabels: Record<MembershipTier, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  ultimate: "Ultimate",
};

function getTargetLabel(options: {
  activeOrganizationName?: string;
  target: { type: "user" | "organization"; id: string };
}): string {
  if (options.target.type === "organization") {
    return (
      options.activeOrganizationName || `organization ${options.target.id}`
    );
  }

  return "your user Membership";
}

export function AdminTierOverrideBanner() {
  const { data: activeOrganization } = useActiveOrganization();
  const {
    adminTierOverride,
    clearAdminTierOverride,
    isAppAdmin,
    isClearingAdminTierOverride,
  } = useMembership();

  if (!(isAppAdmin && adminTierOverride)) {
    return null;
  }

  const targetLabel = getTargetLabel({
    activeOrganizationName:
      adminTierOverride.target.type === "organization" &&
      activeOrganization?.id === adminTierOverride.target.id
        ? activeOrganization?.name
        : undefined,
    target: adminTierOverride.target,
  });
  const tierLabel = tierLabels[adminTierOverride.tier];
  const cadenceLabel = adminTierOverride.billingCadence
    ? ` ${adminTierOverride.billingCadence}`
    : "";

  return (
    <div className="pointer-events-none fixed inset-x-2 top-2 z-50 flex justify-center sm:top-3">
      <div
        className={cn(
          "pointer-events-auto flex w-full max-w-4xl items-center gap-3 rounded-xl border border-amber-300/70 bg-zinc-950/95 px-3 py-2 text-zinc-50 shadow-2xl shadow-amber-950/20 backdrop-blur-md dark:border-amber-400/30",
          "sm:w-auto sm:min-w-[min(52rem,calc(100vw-2rem))] sm:px-4"
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-300 text-zinc-950">
          <ShieldAlert className="size-4" />
        </div>
        <div className="min-w-0 flex-1 text-sm leading-5">
          <span className="font-semibold text-amber-200">
            Admin tier override active:
          </span>{" "}
          <span className="font-medium">
            {tierLabel}
            {cadenceLabel} for {targetLabel}.
          </span>{" "}
          <span className="text-zinc-300">
            Real subscriptions are unchanged.
          </span>
        </div>
        <Button
          className="h-8 shrink-0 border-amber-200/40 bg-zinc-900/60 px-2.5 text-amber-100 hover:bg-amber-200 hover:text-zinc-950 sm:px-3"
          disabled={isClearingAdminTierOverride}
          onClick={clearAdminTierOverride}
          size="sm"
          type="button"
          variant="outline"
        >
          {isClearingAdminTierOverride ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <XCircle className="size-3.5" />
          )}
          <span className="hidden sm:inline">Clear override</span>
          <span className="sm:hidden">Clear</span>
        </Button>
      </div>
    </div>
  );
}
