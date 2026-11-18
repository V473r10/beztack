import { useQuery } from "@tanstack/react-query";
import {
  Book,
  Check,
  ChevronRight,
  HelpCircle,
  Mail,
  Minus,
  Shield,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { PlanChangeDialog } from "@/components/payments/plan-change-dialog";
import { PricingCard } from "@/components/payments/pricing-card";
import { resolvePricingAction, resolveTierProductId } from "@/components/payments/pricing-actions";
import { PricingBar } from "@/components/pricing-bar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlanChangeType } from "@/contexts/membership-context";
import { useMembership } from "@/contexts/membership-context";
import { pricingTiersQueryOptions } from "@/hooks/use-pricing-tiers";
import { authClient } from "@/lib/auth-client";
import { getSignUpPathForCheckout } from "@/lib/checkout-resume";
import { cn } from "@/lib/utils";
import type { PricingTier } from "@/types/pricing";
import {
  type Comparison,
  type ComparisonRow,
  type ComparisonValue,
  buildComparison,
} from "./pricing-comparison";

const LOADING_SKELETON_COUNT = 4;

function renderValue(value: ComparisonValue, unlimitedLabel: string) {
  if (typeof value === "boolean") {
    return value ? (
      <div className="flex items-center justify-center">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
        </div>
      </div>
    ) : (
      <div className="flex items-center justify-center">
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted">
          <Minus className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>
    );
  }
  if (value.kind === "missing") {
    return (
      <div className="flex items-center justify-center">
        <X className="h-4 w-4 text-muted-foreground/50" />
      </div>
    );
  }
  if (value.kind === "unlimited") {
    return <span className="font-medium text-primary text-sm">{unlimitedLabel}</span>;
  }
  return <span className="font-medium text-foreground text-sm">{value.text}</span>;
}

function FeatureComparisonTable({
  columns,
  rows,
}: {
  columns: Comparison["columns"];
  rows: ComparisonRow[];
}) {
  const { t } = useTranslation();

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/50 border-b hover:bg-transparent">
          <TableHead className="min-w-40 font-semibold text-foreground">
            {t("pricing.compare.feature")}
          </TableHead>
          {columns.map((column) => (
            <TableHead className="text-center font-semibold text-foreground" key={column.id}>
              {column.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => (
          <TableRow
            className={cn(
              "border-border/30 border-b transition-colors hover:bg-muted/30",
              idx % 2 === 0 ? "bg-transparent" : "bg-muted/10",
            )}
            key={row.id}
          >
            <TableCell className="py-4 font-medium text-muted-foreground text-sm">
              {row.name}
            </TableCell>
            {columns.map((column) => (
              <TableCell className="py-4 text-center" key={column.id}>
                {renderValue(row.values[column.id] ?? false, t("pricing.unlimited"))}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [showPlanChangeDialog, setShowPlanChangeDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);
  const {
    currentTier,
    activeSubscription,
    hasActiveSubscription,
    isAppAdmin,
    upgradeToTier,
    changePlan,
    getPlanChangeType,
    isLoading,
    isTierUnknown,
  } = useMembership();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();

  // Choosing a plan opens the Plan change dialog (with its proration preview)
  // for a subscriber, whichever source says so, and for an App admin, whose
  // Plan change is an Admin tier override. Everyone else goes to checkout.
  const changesPlan = hasActiveSubscription || isAppAdmin;

  const { data: allTiers = [], isLoading: isLoadingTiers } = useQuery(pricingTiersQueryOptions());

  const hasYearlyPlans = allTiers.some((tier) => tier.price.yearly > 0);
  const savingsPercent = Math.max(...allTiers.map((tier) => tier.yearlySavingsPercent ?? 0));

  const comparison = useMemo(
    () => buildComparison(allTiers, (key, fallback) => t(key, { defaultValue: fallback })),
    [allTiers, t],
  );

  const handleTierSelect = async (productId: string) => {
    // A visitor without an account signs up first, then resumes this checkout.
    if (!session) {
      const tier = allTiers.find(
        (candidate) => candidate.monthly?.id === productId || candidate.yearly?.id === productId,
      );
      if (tier) {
        navigate(getSignUpPathForCheckout({ tierId: tier.id, billingPeriod }));
        return;
      }
    }

    try {
      await upgradeToTier(productId, billingPeriod);
    } catch {
      // Error handling is managed by the membership context
    }
  };

  const handlePlanChange = useCallback((tier: PricingTier) => {
    setSelectedTier(tier);
    setShowPlanChangeDialog(true);
  }, []);

  // The closing call to action offers Pro for the chosen period: a subscriber
  // changes plan, anyone else checks out the Pro product (not the tier id).
  const proTier = allTiers.find((tier) => tier.id === "pro" && !tier.catalogOnly);
  const proProductId = proTier ? resolveTierProductId(proTier, billingPeriod) : undefined;
  const handleGetPro = () => {
    if (!proTier) {
      return;
    }
    const action = resolvePricingAction({ billingPeriod, changesPlan, tier: proTier });
    if (action.kind === "plan-change") {
      handlePlanChange(action.tier);
    } else if (action.kind === "checkout") {
      handleTierSelect(action.productId);
    }
  };

  const handleConfirmPlanChange = useCallback(
    async (productId: string) => {
      await changePlan(productId, {
        billingPeriod,
        prorationBehavior: "prorate",
      });
      setShowPlanChangeDialog(false);
      setSelectedTier(null);
    },
    [billingPeriod, changePlan],
  );

  const getChangeTypeForTier = useCallback(
    (tierId: string): PlanChangeType => {
      return getPlanChangeType(tierId, billingPeriod);
    },
    [getPlanChangeType, billingPeriod],
  );

  const faqItems = [
    {
      id: "faq-1",
      question: t("pricing.faq.changePlanQuestion"),
      answer: t("pricing.faq.changePlanAnswer"),
    },
    {
      id: "faq-2",
      question: t("pricing.faq.downgradeDataQuestion"),
      answer: t("pricing.faq.downgradeDataAnswer"),
    },
    {
      id: "faq-3",
      question: t("pricing.faq.refundsQuestion"),
      answer: t("pricing.faq.refundsAnswer"),
    },
    {
      id: "faq-4",
      question: t("pricing.faq.setupFeeQuestion"),
      answer: t("pricing.faq.setupFeeAnswer"),
    },
    {
      id: "faq-5",
      question: t("pricing.faq.teamsQuestion"),
      answer: t("pricing.faq.teamsAnswer"),
    },
    {
      id: "faq-6",
      question: t("pricing.faq.trialQuestion"),
      answer: t("pricing.faq.trialAnswer"),
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      <PricingBar isSignedIn={Boolean(session)} />

      <div className="container relative mx-auto px-4 py-20">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="mb-4 border-primary/20 bg-primary/10 text-primary" variant="outline">
            <Sparkles className="mr-1.5 h-3 w-3" />
            {t("pricing.hero.badge")}
          </Badge>

          <h1 className="mb-4 font-bold text-4xl tracking-tight md:text-5xl">
            {t("pricing.hero.title")}{" "}
            <span className="bg-linear-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent">
              {t("pricing.hero.titleHighlight")}
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            {t("pricing.hero.subtitle")}
          </p>

          {hasYearlyPlans && (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <div className="rounded-full border border-border/50 bg-muted/30 p-1 backdrop-blur-sm">
                <Tabs
                  className="w-fit"
                  onValueChange={(value) => setBillingPeriod(value as "monthly" | "yearly")}
                  value={billingPeriod}
                >
                  <TabsList className="grid w-full grid-cols-2 bg-transparent">
                    <TabsTrigger
                      className="rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      value="monthly"
                    >
                      {t("billing.monthly")}
                    </TabsTrigger>
                    <TabsTrigger
                      className="relative rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      value="yearly"
                    >
                      {t("billing.yearly")}
                      {savingsPercent > 0 && (
                        <Badge
                          className="ml-2 h-5 border-green-200 bg-green-100 px-1.5 text-green-700 text-xs dark:border-green-800 dark:bg-green-900/30 dark:text-green-400"
                          variant="outline"
                        >
                          {`-${savingsPercent}%`}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </motion.div>
          )}

          {hasYearlyPlans && billingPeriod === "yearly" && (
            <motion.p
              animate={{ opacity: 1 }}
              className="text-green-600 text-sm dark:text-green-400"
              initial={{ opacity: 0 }}
            >
              <Zap className="mr-1 inline h-3.5 w-3.5" />
              {t("pricing.hero.annualBonus")}
            </motion.p>
          )}
        </motion.div>

        <div className="mx-auto mb-24 grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {isLoadingTiers
            ? Array.from({ length: LOADING_SKELETON_COUNT }, () => (
                <Card className="relative" key={crypto.randomUUID()}>
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="mb-4 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-muted" />
                        <div className="flex-1">
                          <div className="mb-2 h-5 w-24 rounded bg-muted" />
                          <div className="h-3 w-32 rounded bg-muted" />
                        </div>
                      </div>
                      <div className="mb-6 h-10 w-28 rounded bg-muted" />
                      <div className="space-y-3">
                        <div className="h-3 rounded bg-muted" />
                        <div className="h-3 w-4/5 rounded bg-muted" />
                        <div className="h-3 w-3/5 rounded bg-muted" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : allTiers.map((tier, index) => (
                <PricingCard
                  billingPeriod={billingPeriod}
                  changeType={getChangeTypeForTier(tier.id)}
                  currentTier={isTierUnknown ? undefined : currentTier}
                  hasActiveSubscription={changesPlan}
                  index={index}
                  isLoading={isLoading}
                  isSignedIn={Boolean(session)}
                  isPopular={tier.id === "pro"}
                  key={tier.id}
                  onPlanChange={handlePlanChange}
                  onSelect={handleTierSelect}
                  tier={tier}
                />
              ))}
        </div>

        {comparison.groups.length > 0 && (
          <motion.div
            className="mb-24"
            initial={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            whileInView={{ opacity: 1 }}
          >
            <div className="mb-10 text-center">
              <h2 className="mb-3 font-bold text-3xl tracking-tight">
                {t("pricing.compare.title")}
              </h2>
              <p className="text-muted-foreground">{t("pricing.compare.description")}</p>
            </div>

            <div className="mx-auto max-w-6xl space-y-6">
              {comparison.groups.map((group) => (
                <Card className="overflow-hidden border-border/50" key={group.id}>
                  <div className="border-border/50 border-b bg-muted/30 px-6 py-4">
                    <h3 className="flex items-center gap-2 font-semibold text-lg">
                      {group.id === "core" && <Sparkles className="h-4 w-4 text-primary" />}
                      {group.id === "usageLimits" && <Zap className="h-4 w-4 text-blue-500" />}
                      {group.id === "permissions" && <Shield className="h-4 w-4 text-orange-500" />}
                      {t(`pricing.compare.${group.id}`)}
                    </h3>
                  </div>
                  <FeatureComparisonTable columns={comparison.columns} rows={group.rows} />
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          className="mb-24"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1 }}
        >
          <div className="mb-10 text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-full bg-muted/50 p-3">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mb-3 font-bold text-3xl tracking-tight">{t("pricing.faq.title")}</h2>
            <p className="text-muted-foreground">{t("pricing.faq.description")}</p>
          </div>

          <div className="mx-auto max-w-3xl">
            <Accordion className="space-y-3" collapsible type="single">
              {faqItems.map((item) => (
                <AccordionItem
                  className="rounded-xl border border-border/50 bg-card/50 px-6 backdrop-blur-sm"
                  key={item.id}
                  value={item.id}
                >
                  <AccordionTrigger className="py-5 text-left font-medium hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="pb-5 text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1, y: 0 }}
        >
          <Card className="relative overflow-hidden border-0 bg-linear-to-br from-primary/10 via-background to-blue-500/10">
            <div className="absolute inset-0 bg-grid-white/5" />
            <CardContent className="relative px-8 py-12 text-center md:py-16">
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>

              <h2 className="mb-4 font-bold text-2xl tracking-tight md:text-3xl">
                {t("pricing.cta.title")}
              </h2>

              <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
                {t("pricing.cta.description")}
              </p>

              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button
                  className="group"
                  disabled={isLoading || !proProductId}
                  onClick={handleGetPro}
                  size="lg"
                >
                  {t("pricing.cta.getStartedPro")}
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <Button size="lg" variant="outline">
                  <Mail className="mr-2 h-4 w-4" />
                  {t("pricing.contactSales")}
                </Button>
                <Button size="lg" variant="ghost">
                  <Book className="mr-2 h-4 w-4" />
                  {t("pricing.cta.viewDocs")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Plan Change Dialog */}
      <PlanChangeDialog
        billingPeriod={billingPeriod}
        changeType={selectedTier ? getChangeTypeForTier(selectedTier.id) : "same"}
        isLoading={isLoading}
        onBillingPeriodChange={setBillingPeriod}
        onConfirm={handleConfirmPlanChange}
        onOpenChange={setShowPlanChangeDialog}
        open={showPlanChangeDialog}
        subscriptionId={activeSubscription?.id}
        targetTier={selectedTier}
      />
    </div>
  );
}
