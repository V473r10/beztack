import { useQuery } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { formatCurrency } from "@/components/payments/pricing-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMembership } from "@/contexts/membership-context";
import { usePricingTiers } from "@/hooks/use-pricing-tiers";
import { type CheckoutSelection, readCheckoutSelection } from "@/lib/checkout-resume";
import { queryKeys } from "@/lib/query-keys";
import type { PricingTier } from "@/types/pricing";

type CheckoutConfirmViewProps = {
  selection: CheckoutSelection | null;
  tier: PricingTier | undefined;
  isLoadingTiers: boolean;
  isStarting: boolean;
  onContinue: (productId: string) => void;
};

/** The plan picked before sign-up, and the action that resumes its checkout. */
export function CheckoutConfirmView({
  selection,
  tier,
  isLoadingTiers,
  isStarting,
  onContinue,
}: CheckoutConfirmViewProps) {
  const { t } = useTranslation();

  if (isLoadingTiers) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const productId =
    selection && tier
      ? (selection.billingPeriod === "yearly" ? tier.yearly : tier.monthly)?.id
      : null;

  if (!(selection && tier && productId) || tier.soon) {
    return (
      <Card className="mx-auto max-w-md">
        <CardHeader>
          <CardTitle>{t("billing.checkoutConfirm.unavailableTitle")}</CardTitle>
          <CardDescription>{t("billing.checkoutConfirm.unavailableDescription")}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild className="w-full">
            <Link to="/pricing">{t("billing.checkoutConfirm.choosePlan")}</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const price = tier.price[selection.billingPeriod];

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{t("billing.checkoutConfirm.title")}</CardTitle>
        <CardDescription>{t("billing.checkoutConfirm.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="font-semibold">{tier.name}</div>
          <div className="mt-1 text-muted-foreground text-sm">
            {formatCurrency(price)} / {t(`billing.${selection.billingPeriod}`)}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          className="w-full gap-2"
          disabled={isStarting}
          onClick={() => onContinue(productId)}
        >
          {isStarting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CreditCard className="h-4 w-4" />
          )}
          {t("billing.checkoutConfirm.continue")}
        </Button>
        <Button asChild className="w-full" variant="ghost">
          <Link to="/pricing">{t("billing.checkoutConfirm.choosePlan")}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

/** `/checkout-confirm?tier=&billingPeriod=`: resumes the plan picked before sign-up. */
export default function CheckoutConfirm() {
  const location = useLocation();
  const selection = readCheckoutSelection(location.search);
  const { upgradeToTier, isLoading } = useMembership();

  const { data: tiers = [], isLoading: isLoadingTiers } = useQuery<PricingTier[]>({
    queryKey: queryKeys.subscriptions.productTiers(),
    queryFn: usePricingTiers,
  });

  const tier = selection ? tiers.find((candidate) => candidate.id === selection.tierId) : undefined;

  return (
    <div className="container mx-auto px-4 py-16">
      <CheckoutConfirmView
        isLoadingTiers={isLoadingTiers}
        isStarting={isLoading}
        onContinue={(productId) => {
          if (selection) {
            upgradeToTier(productId, selection.billingPeriod).catch(() => {
              // The membership context reports checkout errors.
            });
          }
        }}
        selection={selection}
        tier={tier}
      />
    </div>
  );
}
