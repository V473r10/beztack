import { hasAuthRole } from "@beztack/auth";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { CreateOrganizationDialog } from "@/components/organizations/create-organization-dialog";
import { TourAlertDialog, type TourStep, useTour } from "@/components/tour";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useMembership } from "@/contexts/membership-context";
import { env } from "@/env";
import { useActiveOrganization, useOrganizationMembers } from "@/hooks/use-organizations";
import { usePendingPlanChange } from "@/hooks/use-pending-plan-change";
import { formatDate, formatPrice } from "@/lib/format";
import { getInitials } from "@/lib/initials";
import type { OrganizationMember } from "@/lib/organization-types";
import { TOUR_STEP_IDS } from "@/lib/tour-constants";

const TOUR_OPEN_DELAY = 100;
const MEMBERS_SHOWN = 5;
const PERCENT = 100;
const KNOWN_STATUSES = ["active", "inactive", "pending", "canceled", "paused", "past_due"];

type Cadence = "monthly" | "yearly";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** The tier's name in the user's language; an unknown tier keeps the given fallback. */
function tierName(t: TFunction, tierId: string, fallback?: string): string {
  return t(`membership.tiers.${tierId}`, { defaultValue: fallback ?? capitalize(tierId) });
}

/** A plan limit of -1, or no limit at all, means the plan does not cap the number. */
function seatLimitOf(limits: Record<string, number> | undefined): number | null {
  const limit = limits?.users;
  return typeof limit === "number" && limit >= 0 ? limit : null;
}

function planStatusOf(args: {
  isFree: boolean;
  hasAdminOverride: boolean;
  subscription: { status: string; cancelAtPeriodEnd?: boolean } | null;
}): string {
  if (args.hasAdminOverride) {
    return "adminOverride";
  }
  if (args.subscription) {
    if (args.subscription.cancelAtPeriodEnd) {
      return "canceling";
    }
    return KNOWN_STATUSES.includes(args.subscription.status) ? args.subscription.status : "active";
  }
  return args.isFree ? "free" : "active";
}

function HomeSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

function NoOrganization() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("home.noOrganization.title")}</CardTitle>
          <CardDescription>{t("home.noOrganization.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)}>{t("home.noOrganization.create")}</Button>
        </CardContent>
      </Card>
      <CreateOrganizationDialog onOpenChange={setOpen} open={open} />
    </div>
  );
}

function PlanUnavailable({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="px-4 lg:px-6">
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>{t("billing.membershipUnavailable.title")}</AlertTitle>
        <AlertDescription>
          <p>{t("billing.membershipUnavailable.message")}</p>
          <Button onClick={onRetry} size="sm" type="button" variant="outline">
            {t("billing.membershipUnavailable.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}

function MemberRow({ member }: { member: OrganizationMember }) {
  const { t } = useTranslation();
  const name = member.user?.name || member.user?.email || member.email;
  const email = member.user?.email ?? member.email;

  return (
    <li className="flex min-w-0 items-center gap-3">
      <Avatar className="size-8">
        <AvatarImage alt="" src={member.user?.image} />
        <AvatarFallback>{getInitials({ name: member.user?.name, email })}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{name}</p>
        {name === email ? null : <p className="truncate text-muted-foreground text-xs">{email}</p>}
      </div>
      <Badge variant="secondary">{t(`invitation.roles.${member.role}`)}</Badge>
    </li>
  );
}

function useHomeTour(ready: boolean) {
  const { t } = useTranslation();
  const { setSteps, isTourCompleted } = useTour();
  const [openTour, setOpenTour] = useState(false);

  const stepSpecs = useMemo(
    () => [
      { selectorId: TOUR_STEP_IDS.Home.PLAN_CARD, text: t("tour.homeTour.plan") },
      { selectorId: TOUR_STEP_IDS.Home.NEXT_STEPS_CARD, text: t("tour.homeTour.nextSteps") },
      { selectorId: TOUR_STEP_IDS.SETTINGS_BUTTON, text: t("tour.homeTour.step1") },
    ],
    [t],
  );

  useEffect(() => {
    if (!ready || localStorage.getItem("home_tour_completed") === "true") {
      return;
    }

    // The sidebar is a closed sheet on mobile and the cards depend on the account: only
    // point at elements that are on the page now.
    const steps: TourStep[] = stepSpecs
      .filter((spec) => document.getElementById(spec.selectorId))
      .map((spec) => ({
        content: <div className="p-2">{spec.text}</div>,
        selectorId: spec.selectorId,
        position: spec.selectorId === TOUR_STEP_IDS.SETTINGS_BUTTON ? "right" : "bottom",
      }));
    if (steps.length === 0) {
      return;
    }

    setSteps(steps);
    const timer = setTimeout(() => {
      setOpenTour(true);
    }, TOUR_OPEN_DELAY);

    return () => clearTimeout(timer);
  }, [ready, setSteps, isTourCompleted, stepSpecs]);

  return { openTour, setOpenTour };
}

export default function Home() {
  const { t } = useTranslation();
  const membership = useMembership();
  const { data: organization, isLoading: isOrganizationLoading } = useActiveOrganization();
  const organizationId = organization?.id;
  const { data: members = [], isLoading: isMembersLoading } =
    useOrganizationMembers(organizationId);
  const { data: pendingPlanChange } = usePendingPlanChange(
    organizationId,
    membership.canManageBilling,
  );

  const needsOrganization = env.VITE_SUBSCRIPTION_MODE === "organization" && !organization;
  const isLoading = isOrganizationLoading || (!needsOrganization && membership.isAccessLoading);
  const { openTour, setOpenTour } = useHomeTour(!isLoading);

  if (isLoading) {
    return <HomeSkeleton />;
  }
  if (needsOrganization) {
    return <NoOrganization />;
  }
  // Not knowing the plan is not the Free plan: say so instead of showing it.
  if (membership.isTierUnknown) {
    return <PlanUnavailable onRetry={() => membership.refreshMembership()} />;
  }

  const { currentTier, tierConfig, activeSubscription } = membership;
  const isFree = currentTier === "free";
  const cadence: Cadence | null = membership.billingCadence;
  const planPrice = cadence ? (tierConfig?.price[cadence] ?? 0) : 0;
  const status = planStatusOf({
    isFree,
    hasAdminOverride: membership.adminTierOverride !== null,
    subscription: activeSubscription,
  });
  const periodEnd = activeSubscription?.currentPeriodEnd;

  const seatLimit = seatLimitOf(tierConfig?.limits);
  const seatsUsed = members.length;
  const hasFreeSeat = seatLimit === null || seatsUsed < seatLimit;
  const canInviteMembers =
    organization !== null &&
    organization !== undefined &&
    ["admin", "owner"].some((role) => hasAuthRole<string>(membership.organizationRole, role));

  const nextSteps: Array<{ key: string; href: string }> = [];
  if (isFree && membership.canManageBilling) {
    nextSteps.push({ key: "pay", href: "/pricing" });
  }
  if (canInviteMembers && hasFreeSeat) {
    nextSteps.push({ key: "invite", href: "/organizations" });
  }
  if (!isFree && membership.canManageBilling) {
    nextSteps.push({ key: "changePlan", href: "/pricing" });
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:px-6">
        <Card id={TOUR_STEP_IDS.Home.PLAN_CARD}>
          <CardHeader>
            <CardDescription>{t("home.plan.title")}</CardDescription>
            <CardTitle className="flex flex-wrap items-center gap-2 text-2xl">
              {tierName(t, currentTier, tierConfig?.name)}
              <Badge variant={status === "past_due" ? "destructive" : "secondary"}>
                {t(`home.plan.status.${status}`)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {!isFree && cadence && planPrice > 0 ? (
              <p>
                {t("home.plan.price", {
                  price: formatPrice(planPrice, tierConfig?.currency),
                  cadence: t(`billing.${cadence}`),
                })}
              </p>
            ) : null}
            {periodEnd ? (
              <p className="text-muted-foreground">
                {t(status === "canceling" ? "home.plan.endsOn" : "home.plan.renews", {
                  date: formatDate(periodEnd, { dateStyle: "long" }),
                })}
              </p>
            ) : null}
            {isFree ? (
              <p className="text-muted-foreground">{t("home.plan.freeDescription")}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card id={TOUR_STEP_IDS.Home.NEXT_STEPS_CARD}>
          <CardHeader>
            <CardTitle>{t("home.nextSteps.title")}</CardTitle>
            <CardDescription>{t("home.nextSteps.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            {nextSteps.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {nextSteps.map((step) => (
                  <li key={step.key}>
                    <Button asChild variant={step.key === "pay" ? "default" : "outline"}>
                      <Link to={step.href}>{t(`home.nextSteps.${step.key}`)}</Link>
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">{t("home.nextSteps.none")}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {pendingPlanChange ? (
        <div className="px-4 lg:px-6">
          <Alert>
            <CalendarClock className="size-4" />
            <AlertTitle>{t("home.pendingPlanChange.title")}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {pendingPlanChange.effectiveAt
                  ? t(`billing.pendingPlanChange.${pendingPlanChange.direction}On`, {
                      tier: tierName(t, pendingPlanChange.targetPlan.tierId),
                      cadence: t(`billing.${pendingPlanChange.targetPlan.billingCadence}`),
                      price: formatPrice(
                        pendingPlanChange.targetPlan.price.amount,
                        pendingPlanChange.targetPlan.price.currency,
                      ),
                      date: formatDate(pendingPlanChange.effectiveAt, { dateStyle: "long" }),
                    })
                  : t(`billing.pendingPlanChange.${pendingPlanChange.direction}AtRenewal`, {
                      tier: tierName(t, pendingPlanChange.targetPlan.tierId),
                      cadence: t(`billing.${pendingPlanChange.targetPlan.billingCadence}`),
                      price: formatPrice(
                        pendingPlanChange.targetPlan.price.amount,
                        pendingPlanChange.targetPlan.price.currency,
                      ),
                    })}
              </span>
              <Button asChild size="sm" variant="outline">
                <Link to="/billing">{t("home.pendingPlanChange.manage")}</Link>
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      {organization ? (
        <div className="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:px-6">
          <Card>
            <CardHeader>
              <CardDescription>{t("home.seats.title")}</CardDescription>
              <CardTitle className="text-2xl">
                {seatLimit === null
                  ? t(
                      tierConfig?.limits.users === -1
                        ? "home.seats.usedUnlimited"
                        : "home.seats.used",
                      {
                        count: seatsUsed,
                      },
                    )
                  : t("home.seats.usedOfLimit", { used: seatsUsed, limit: seatLimit })}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {seatLimit !== null && seatLimit > 0 ? (
                <Progress value={Math.min(PERCENT, (seatsUsed / seatLimit) * PERCENT)} />
              ) : null}
              {seatLimit !== null && seatsUsed > seatLimit ? (
                <Alert variant="destructive">
                  <TriangleAlert className="size-4" />
                  <AlertDescription>
                    {t("home.seats.overLimit", { used: seatsUsed, limit: seatLimit })}
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("home.members.title", { organization: organization.name })}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isMembersLoading ? (
                <Skeleton className="h-16 w-full" />
              ) : (
                <ul className="space-y-3">
                  {members.slice(0, MEMBERS_SHOWN).map((member) => (
                    <MemberRow key={member.id} member={member} />
                  ))}
                </ul>
              )}
              {members.length > MEMBERS_SHOWN ? (
                <Button asChild size="sm" variant="link">
                  <Link to="/organizations">
                    {t("home.members.viewAll", { count: members.length })}
                  </Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}
      <TourAlertDialog isOpen={openTour} setIsOpen={setOpenTour} />
    </div>
  );
}
