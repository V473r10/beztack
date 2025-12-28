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
import { PlanChangeDialog } from "@/components/payments/plan-change-dialog";
import { PricingCard } from "@/components/payments/pricing-card";
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
import { usePolarProducts } from "@/hooks/use-polar-products";
import { cn } from "@/lib/utils";
import type { PolarPricingTier } from "@/types/polar-pricing";

const SAVE_PERCENTAGE = 17;
const LOADING_SKELETON_COUNT = 3;

type FeatureValue = boolean | string | number;

type FeatureRow = {
  id: number;
  name: string;
  basic: FeatureValue;
  pro: FeatureValue;
  ultimate: FeatureValue;
};

type GroupedFeatures = Record<string, FeatureRow[]>;

function buildTierData(allTiers: PolarPricingTier[]) {
  const tierMap: Record<string, PolarPricingTier> = {};
  const allFeatures = new Set<string>();
  const allLimits = new Set<string>();
  const allPermissions = new Set<string>();

  for (const tier of allTiers) {
    tierMap[tier.id] = tier;
    for (const feature of tier.features || []) {
      allFeatures.add(feature);
    }
    for (const limit of Object.keys(tier.limits || {})) {
      allLimits.add(limit);
    }
    for (const permission of Object.keys(tier.permissions || {})) {
      allPermissions.add(permission);
    }
  }

  return { tierMap, allFeatures, allLimits, allPermissions };
}

function processFeatures(
  tierMap: Record<string, PolarPricingTier>,
  allFeatures: Set<string>,
  featureId: { current: number },
  t: (key: string, fallback?: string) => string
): FeatureRow[] {
  const rows: FeatureRow[] = [];

  for (const feature of allFeatures) {
    const row: FeatureRow = {
      id: featureId.current++,
      name: t(`pricing.features.${feature}`, feature),
      basic: (tierMap.basic?.features || []).includes(feature),
      pro: (tierMap.pro?.features || []).includes(feature),
      ultimate: (tierMap.ultimate?.features || []).includes(feature),
    };
    rows.push(row);
  }

  return rows;
}

function processLimits(
  tierMap: Record<string, PolarPricingTier>,
  allLimits: Set<string>,
  featureId: { current: number },
  t: (key: string, fallback?: string) => string
): FeatureRow[] {
  const rows: FeatureRow[] = [];

  for (const limit of allLimits) {
    const formatLimit = (value: number | undefined) => {
      if (value === undefined) {
        return "-";
      }
      if (value === -1) {
        return "Unlimited";
      }
      if (limit === "storage") {
        return `${value}GB`;
      }
      return value.toLocaleString();
    };

    const row: FeatureRow = {
      id: featureId.current++,
      name: t(
        `pricing.limits.${limit}`,
        limit.replace(/([A-Z])/g, " $1").trim()
      ),
      basic: formatLimit(tierMap.basic?.limits?.[limit]),
      pro: formatLimit(tierMap.pro?.limits?.[limit]),
      ultimate: formatLimit(tierMap.ultimate?.limits?.[limit]),
    };
    rows.push(row);
  }

  return rows;
}

function processPermissions(
  tierMap: Record<string, PolarPricingTier>,
  allPermissions: Set<string>,
  featureId: { current: number },
  t: (key: string, fallback?: string) => string
): FeatureRow[] {
  const rows: FeatureRow[] = [];

  for (const permission of allPermissions) {
    const row: FeatureRow = {
      id: featureId.current++,
      name: t(
        `pricing.permissions.${permission}`,
        permission.replace(/([A-Z])/g, " $1").trim()
      ),
      basic: tierMap.basic?.permissions?.[permission] ?? false,
      pro: tierMap.pro?.permissions?.[permission] ?? false,
      ultimate: tierMap.ultimate?.permissions?.[permission] ?? false,
    };
    rows.push(row);
  }

  return rows;
}

type ProcessAllCategoriesParams = {
  tierMap: Record<string, PolarPricingTier>;
  allFeatures: Set<string>;
  allLimits: Set<string>;
  allPermissions: Set<string>;
  featureId: { current: number };
  t: (key: string, fallback?: string) => string;
};

function processAllCategories({
  tierMap,
  allFeatures,
  allLimits,
  allPermissions,
  featureId,
  t,
}: ProcessAllCategoriesParams): GroupedFeatures {
  const grouped: GroupedFeatures = {};

  if (allFeatures.size > 0) {
    grouped["Core Features"] = processFeatures(
      tierMap,
      allFeatures,
      featureId,
      t
    );
  }
  if (allLimits.size > 0) {
    grouped["Usage Limits"] = processLimits(tierMap, allLimits, featureId, t);
  }
  if (allPermissions.size > 0) {
    grouped.Permissions = processPermissions(
      tierMap,
      allPermissions,
      featureId,
      t
    );
  }

  return grouped;
}

function FeatureComparisonTable({ features }: { features: FeatureRow[] }) {
  const renderValue = (value: FeatureValue) => {
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
    if (value === "-") {
      return (
        <div className="flex items-center justify-center">
          <X className="h-4 w-4 text-muted-foreground/50" />
        </div>
      );
    }
    if (value === "Unlimited") {
      return (
        <span className="font-medium text-primary text-sm">Unlimited</span>
      );
    }
    return <span className="font-medium text-foreground text-sm">{value}</span>;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="border-border/50 border-b hover:bg-transparent">
          <TableHead className="w-[40%] font-semibold text-foreground">
            Feature
          </TableHead>
          <TableHead className="text-center font-semibold text-foreground">
            Basic
          </TableHead>
          <TableHead className="text-center font-semibold text-foreground">
            Pro
          </TableHead>
          <TableHead className="text-center font-semibold text-foreground">
            Ultimate
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {features.map((feature, idx) => (
          <TableRow
            className={cn(
              "border-border/30 border-b transition-colors hover:bg-muted/30",
              idx % 2 === 0 ? "bg-transparent" : "bg-muted/10"
            )}
            key={feature.id}
          >
            <TableCell className="py-4 font-medium text-muted-foreground text-sm">
              {feature.name}
            </TableCell>
            <TableCell className="py-4 text-center">
              {renderValue(feature.basic)}
            </TableCell>
            <TableCell className="py-4 text-center">
              {renderValue(feature.pro)}
            </TableCell>
            <TableCell className="py-4 text-center">
              {renderValue(feature.ultimate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">(
    "monthly"
  );
  const [showPlanChangeDialog, setShowPlanChangeDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PolarPricingTier | null>(
    null
  );
  const {
    currentTier,
    activeSubscription,
    upgradeToTier,
    changePlan,
    getPlanChangeType,
    isLoading,
  } = useMembership();
  const { t } = useTranslation();

  const hasActiveSubscription = Boolean(activeSubscription);

  const { data: allTiers = [], isLoading: isLoadingTiers } = useQuery<
    PolarPricingTier[]
  >({
    queryKey: ["polar-products"],
    queryFn: usePolarProducts,
  });

  const groupedFeatures = useMemo(() => {
    if (!allTiers.length) {
      return {};
    }

    const featureId = { current: 1 };
    const { tierMap, allFeatures, allLimits, allPermissions } =
      buildTierData(allTiers);

    return processAllCategories({
      tierMap,
      allFeatures,
      allLimits,
      allPermissions,
      featureId,
      t: (key, fallback) => t(key, { defaultValue: fallback || key }),
    });
  }, [allTiers, t]);

  const handleTierSelect = async (productId: string) => {
    try {
      await upgradeToTier(productId, billingPeriod);
    } catch {
      // Error handling is managed by the membership context
    }
  };

  const handlePlanChange = useCallback((tier: PolarPricingTier) => {
    setSelectedTier(tier);
    setShowPlanChangeDialog(true);
  }, []);

  const handleConfirmPlanChange = useCallback(
    async (productId: string) => {
      await changePlan(productId, { prorationBehavior: "prorate" });
      setShowPlanChangeDialog(false);
      setSelectedTier(null);
    },
    [changePlan]
  );

  const getChangeTypeForTier = useCallback(
    (tierId: string): PlanChangeType => {
      return getPlanChangeType(tierId);
    },
    [getPlanChangeType]
  );

  const faqItems = [
    {
      id: "faq-1",
      question: "Can I change my plan anytime?",
      answer:
        "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the billing accordingly.",
    },
    {
      id: "faq-2",
      question: "What happens to my data if I downgrade?",
      answer:
        "Your data remains safe. If you exceed the limits of a lower plan, you'll have read-only access to the excess data until you upgrade again or reduce usage.",
    },
    {
      id: "faq-3",
      question: "Do you offer refunds?",
      answer:
        "We offer a 30-day money-back guarantee for annual plans. Monthly subscriptions can be canceled anytime without penalty.",
    },
    {
      id: "faq-4",
      question: "Is there a setup fee?",
      answer:
        "No, there are no setup fees or hidden charges. You only pay for the plan you choose.",
    },
    {
      id: "faq-5",
      question: "How does billing work for teams?",
      answer:
        "Team plans are billed per organization. All members within the organization share the plan limits and features.",
    },
    {
      id: "faq-6",
      question: "Can I try before I buy?",
      answer:
        "Yes! Start with our free plan to explore the basics, then upgrade when you're ready for more advanced features.",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-[400px] w-[400px] rounded-full bg-blue-500/5 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      <div className="container relative mx-auto px-4 py-20">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mb-16 text-center"
          initial={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
        >
          <Badge
            className="mb-4 border-primary/20 bg-primary/10 text-primary"
            variant="outline"
          >
            <Sparkles className="mr-1.5 h-3 w-3" />
            Simple Pricing
          </Badge>

          <h1 className="mb-4 font-bold text-4xl tracking-tight md:text-5xl">
            Choose your{" "}
            <span className="bg-linear-to-r from-primary via-blue-500 to-primary bg-clip-text text-transparent">
              perfect plan
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground">
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>

          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            className="mb-4 flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <div className="rounded-full border border-border/50 bg-muted/30 p-1 backdrop-blur-sm">
              <Tabs
                className="w-fit"
                onValueChange={(value) =>
                  setBillingPeriod(value as "monthly" | "yearly")
                }
                value={billingPeriod}
              >
                <TabsList className="grid w-full grid-cols-2 bg-transparent">
                  <TabsTrigger
                    className="rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    value="monthly"
                  >
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger
                    className="relative rounded-full px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                    value="yearly"
                  >
                    Yearly
                    <Badge
                      className="ml-2 h-5 border-green-200 bg-green-100 px-1.5 text-green-700 text-xs dark:border-green-800 dark:bg-green-900/30 dark:text-green-400"
                      variant="outline"
                    >
                      -{SAVE_PERCENTAGE}%
                    </Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </motion.div>

          {billingPeriod === "yearly" && (
            <motion.p
              animate={{ opacity: 1 }}
              className="text-green-600 text-sm dark:text-green-400"
              initial={{ opacity: 0 }}
            >
              <Zap className="mr-1 inline h-3.5 w-3.5" />
              Get 2 months free with annual billing
            </motion.p>
          )}
        </motion.div>

        <div className="mx-auto mb-24 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                  currentTier={currentTier}
                  hasActiveSubscription={hasActiveSubscription}
                  index={index}
                  isLoading={isLoading}
                  isPopular={tier.id === "pro"}
                  key={tier.id}
                  onPlanChange={handlePlanChange}
                  onSelect={handleTierSelect}
                  tier={tier}
                />
              ))}
        </div>

        <motion.div
          className="mb-24"
          initial={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
          whileInView={{ opacity: 1 }}
        >
          <div className="mb-10 text-center">
            <h2 className="mb-3 font-bold text-3xl tracking-tight">
              Compare all features
            </h2>
            <p className="text-muted-foreground">
              See exactly what's included in each plan
            </p>
          </div>

          <div className="mx-auto max-w-5xl space-y-6">
            {Object.entries(groupedFeatures).map(([category, features]) => (
              <Card className="overflow-hidden border-border/50" key={category}>
                <div className="border-border/50 border-b bg-muted/30 px-6 py-4">
                  <h3 className="flex items-center gap-2 font-semibold text-lg">
                    {category === "Core Features" && (
                      <Sparkles className="h-4 w-4 text-primary" />
                    )}
                    {category === "Usage Limits" && (
                      <Zap className="h-4 w-4 text-blue-500" />
                    )}
                    {category === "Permissions" && (
                      <Shield className="h-4 w-4 text-orange-500" />
                    )}
                    {category}
                  </h3>
                </div>
                <FeatureComparisonTable features={features} />
              </Card>
            ))}
          </div>
        </motion.div>

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
            <h2 className="mb-3 font-bold text-3xl tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-muted-foreground">
              Everything you need to know about our pricing
            </p>
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
                Ready to get started?
              </h2>

              <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
                Join thousands of teams already using Beztack to secure and
                scale their applications.
              </p>

              <div className="flex flex-col justify-center gap-4 sm:flex-row">
                <Button
                  className="group"
                  disabled={isLoading}
                  onClick={() => handleTierSelect("pro")}
                  size="lg"
                >
                  Get Started with Pro
                  <ChevronRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
                <Button size="lg" variant="outline">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Sales
                </Button>
                <Button size="lg" variant="ghost">
                  <Book className="mr-2 h-4 w-4" />
                  View Docs
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Plan Change Dialog */}
      <PlanChangeDialog
        billingPeriod={billingPeriod}
        changeType={
          selectedTier ? getChangeTypeForTier(selectedTier.id) : "same"
        }
        currentTier={currentTier}
        isLoading={isLoading}
        onBillingPeriodChange={setBillingPeriod}
        onConfirm={handleConfirmPlanChange}
        onOpenChange={setShowPlanChangeDialog}
        open={showPlanChangeDialog}
        targetTier={selectedTier}
      />
    </div>
  );
}
