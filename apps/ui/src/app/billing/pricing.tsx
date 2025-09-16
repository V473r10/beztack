import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Mail, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { PricingCard } from "@/components/payments/pricing-card";
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
import { useMembership } from "@/contexts/membership-context";
import { usePolarProducts } from "@/hooks/use-polar-products";
import type { PolarPricingTier } from "@/types/polar-pricing";

// Constants
const UNLIMITED_VALUE = 999_999;
const SAVE_PERCENTAGE = 17;
const LOADING_SKELETON_COUNT = 3;

// Helper functions
const hasFeature = (
  tier: PolarPricingTier | undefined,
  feature: string
): boolean => {
  return Boolean(tier?.features?.includes(feature));
};

const hasPermission = (
  tier: PolarPricingTier | undefined,
  permission: string
): boolean => {
  return Boolean(tier?.permissions?.includes(permission));
};

// Helper function to process features
const processFeatures = (
  allFeatures: Set<string>,
  tiers: {
    basic: PolarPricingTier | undefined;
    pro: PolarPricingTier | undefined;
    ultimate: PolarPricingTier | undefined;
  },
  featureId: { current: number },
  t: (key: string, options?: { defaultValue?: string }) => string
) => {
  const category = t("pricing.categories.features");
  return Array.from(allFeatures, (feature) => ({
    id: featureId.current++,
    category,
    feature: t(`pricing.features.${feature}`, { defaultValue: feature }),
    basic: hasFeature(tiers.basic, feature),
    pro: hasFeature(tiers.pro, feature),
    ultimate: hasFeature(tiers.ultimate, feature),
  }));
};

// Helper function to process limits
const processLimits = (
  allLimits: Set<string>,
  tiers: {
    basic: PolarPricingTier | undefined;
    pro: PolarPricingTier | undefined;
    ultimate: PolarPricingTier | undefined;
  },
  featureId: { current: number },
  t: (key: string, options?: { defaultValue?: string }) => string
) => {
  const formatLimitValue = (value: number | undefined) => {
    if (value === undefined) {
      return false;
    }
    if (value === -1 || value === UNLIMITED_VALUE) {
      return t("pricing.unlimited");
    }
    return value.toLocaleString();
  };

  const category = t("pricing.categories.limits");
  return Array.from(allLimits, (limit) => ({
    id: featureId.current++,
    category,
    feature: t(`pricing.limits.${limit}`, { defaultValue: limit }),
    basic: formatLimitValue(tiers.basic?.limits?.[limit]),
    pro: formatLimitValue(tiers.pro?.limits?.[limit]),
    ultimate: formatLimitValue(tiers.ultimate?.limits?.[limit]),
  }));
};

// Helper function to process permissions
const processPermissions = (
  allPermissions: Set<string>,
  tiers: {
    basic: PolarPricingTier | undefined;
    pro: PolarPricingTier | undefined;
    ultimate: PolarPricingTier | undefined;
  },
  featureId: { current: number },
  t: (key: string, options?: { defaultValue?: string }) => string
) => {
  const category = t("pricing.categories.features");
  return Array.from(allPermissions, (permission) => ({
    id: featureId.current++,
    category,
    feature: t(`pricing.permissions.${permission}`, {
      defaultValue: permission,
    }),
    basic: hasPermission(tiers.basic, permission),
    pro: hasPermission(tiers.pro, permission),
    ultimate: hasPermission(tiers.ultimate, permission),
  }));
};

// Helper function to build tier map and collect all unique items
const buildTierData = (allTiers: PolarPricingTier[]) => {
  const tierMap = new Map<string, PolarPricingTier>();
  const allFeatures = new Set<string>();
  const allLimits = new Set<string>();
  const allPermissions = new Set<string>();

  for (const tier of allTiers) {
    tierMap.set(tier.id, tier);
    if (tier.features) {
      for (const feature of tier.features) {
        allFeatures.add(feature);
      }
    }
    for (const limit of Object.keys(tier.limits || {})) {
      allLimits.add(limit);
    }
    if (tier.permissions) {
      for (const permission of tier.permissions) {
        allPermissions.add(permission);
      }
    }
  }

  return { tierMap, allFeatures, allLimits, allPermissions };
};

// Helper function to process all categories
const processAllCategories = (data: {
  tierMap: Map<string, PolarPricingTier>;
  allFeatures: Set<string>;
  allLimits: Set<string>;
  allPermissions: Set<string>;
  featureId: { current: number };
  t: (key: string, options?: { defaultValue?: string }) => string;
}) => {
  const categories: Record<string, FeatureRow[]> = {};
  const tiers = {
    basic: data.tierMap.get("basic"),
    pro: data.tierMap.get("pro"),
    ultimate: data.tierMap.get("ultimate"),
  };

  // Process features
  if (data.allFeatures.size > 0) {
    const category = data.t("pricing.categories.features");
    categories[category] = processFeatures(
      data.allFeatures,
      tiers,
      data.featureId,
      data.t
    );
  }

  // Process limits
  if (data.allLimits.size > 0) {
    const category = data.t("pricing.categories.limits");
    categories[category] = processLimits(
      data.allLimits,
      tiers,
      data.featureId,
      data.t
    );
  }

  // Process permissions
  if (data.allPermissions.size > 0) {
    const category = data.t("pricing.categories.features");
    if (!categories[category]) {
      categories[category] = [];
    }

    const permissionRows = processPermissions(
      data.allPermissions,
      tiers,
      data.featureId,
      data.t
    );
    categories[category].push(...permissionRows);
  }

  return categories;
};

// Feature schema for DataTable
export const featureSchema = z.object({
  id: z.number(),
  category: z.string(),
  feature: z.string(),
  basic: z.boolean().or(z.string()),
  pro: z.boolean().or(z.string()),
  ultimate: z.boolean().or(z.string()),
});

export type FeatureRow = z.infer<typeof featureSchema>;

// Feature cell component to render boolean/string values appropriately
function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return (
      <div className="text-center">
        {value ? (
          <Check className="mx-auto h-4 w-4 text-green-600" />
        ) : (
          <X className="mx-auto h-4 w-4 text-muted-foreground" />
        )}
      </div>
    );
  }
  return <div className="text-center">{value}</div>;
}

// Feature comparison table component
function FeatureComparisonTable({ features }: { features: FeatureRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Feature</TableHead>
          <TableHead className="text-center">Basic</TableHead>
          <TableHead className="text-center">Pro</TableHead>
          <TableHead className="text-center">Ultimate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {features.map((feature) => (
          <TableRow key={feature.id}>
            <TableCell className="font-medium">{feature.feature}</TableCell>
            <TableCell>
              <FeatureCell value={feature.basic} />
            </TableCell>
            <TableCell>
              <FeatureCell value={feature.pro} />
            </TableCell>
            <TableCell>
              <FeatureCell value={feature.ultimate} />
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
  const { currentTier, upgradeToTier, isLoading } = useMembership();
  const { t } = useTranslation();

  const { data: allTiers = [], isLoading: isLoadingTiers } = useQuery<
    PolarPricingTier[]
  >({
    queryKey: ["polar-products"],
    queryFn: usePolarProducts,
  });

  // Generate feature comparison data from API response
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
      // The error will be displayed to the user through the UI
    }
  };

  const faqItems = [
    {
      question: "Can I change my plan anytime?",
      answer:
        "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the billing accordingly.",
    },
    {
      question: "What happens to my data if I downgrade?",
      answer:
        "Your data remains safe. If you exceed the limits of a lower plan, you'll have read-only access to the excess data until you upgrade again or reduce usage.",
    },
    {
      question: "Do you offer refunds?",
      answer:
        "We offer a 30-day money-back guarantee for annual plans. Monthly subscriptions can be canceled anytime without penalty.",
    },
    {
      question: "Is there a setup fee?",
      answer:
        "No, there are no setup fees or hidden charges. You only pay for the plan you choose.",
    },
    {
      question: "How does billing work for teams?",
      answer:
        "Team plans are billed per organization. All members within the organization share the plan limits and features.",
    },
    {
      question: "Can I try before I buy?",
      answer:
        "Yes! Start with our free plan to explore the basics, then upgrade when you're ready for more advanced features.",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16">
      {/* Header */}
      <div className="mb-16 text-center">
        <h1 className="mb-4 font-bold text-4xl">Simple, transparent pricing</h1>
        <p className="mx-auto mb-8 max-w-2xl text-muted-foreground text-xl">
          Choose the perfect plan for your needs. Upgrade or downgrade at any
          time.
        </p>

        {/* Billing Toggle */}
        <div className="mb-4 flex items-center justify-center">
          <Tabs
            className="w-fit"
            onValueChange={(value) =>
              setBillingPeriod(value as "monthly" | "yearly")
            }
            value={billingPeriod}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger className="relative" value="yearly">
                Yearly
                <Badge
                  className="ml-2 h-5 bg-green-100 px-1.5 text-green-700 text-xs dark:bg-green-900/30 dark:text-green-400"
                  variant="secondary"
                >
                  Save {SAVE_PERCENTAGE}%
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {billingPeriod === "yearly" && (
          <p className="text-muted-foreground text-sm">
            Get 2 months free with annual billing
          </p>
        )}
      </div>

      {/* Pricing Grid */}
      <div className="mb-16 grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3">
        {isLoadingTiers
          ? // Loading skeleton
            Array.from({ length: LOADING_SKELETON_COUNT }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: <Is just a loading skeleton>
              <Card className="relative" key={`loading-skeleton-${index}`}>
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="mb-2 h-4 w-3/4 rounded bg-muted" />
                    <div className="mb-4 h-2 w-full rounded bg-muted" />
                    <div className="mb-4 h-8 w-1/2 rounded bg-muted" />
                    <div className="space-y-2">
                      <div className="h-2 rounded bg-muted" />
                      <div className="h-2 rounded bg-muted" />
                      <div className="h-2 rounded bg-muted" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          : allTiers.map((tier) => (
              <PricingCard
                billingPeriod={billingPeriod}
                currentTier={currentTier}
                isLoading={isLoading}
                isPopular={tier.id === "pro"}
                key={tier.id}
                onSelect={handleTierSelect}
                tier={tier}
              />
            ))}
      </div>

      {/* Feature Comparison Table */}
      <div className="mb-16">
        <div className="mb-8 text-center">
          <h2 className="mb-4 font-bold text-3xl">Compare features</h2>
          <p className="text-muted-foreground">
            See exactly what's included in each plan
          </p>
        </div>

        {/* Render features grouped by category */}
        <div className="space-y-8">
          {Object.entries(groupedFeatures).map(([category, features]) => (
            <Card key={category}>
              <CardContent className="p-0">
                <div className="border-b bg-muted/30 p-4">
                  <h3 className="font-semibold text-lg">{category}</h3>
                </div>
                <FeatureComparisonTable features={features} />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mb-16">
        <div className="mb-8 text-center">
          <h2 className="mb-4 font-bold text-3xl">
            Frequently asked questions
          </h2>
          <p className="text-muted-foreground">
            Have questions? We've got answers.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {faqItems.map((item) => (
            <Card key={item.question}>
              <CardContent className="p-6">
                <h3 className="mb-2 font-semibold">{item.question}</h3>
                <p className="text-muted-foreground text-sm">{item.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-8">
            <h2 className="mb-4 font-bold text-2xl">Ready to get started?</h2>
            <p className="mb-6 text-lg opacity-90">
              Join thousands of teams already using nvn to secure their
              applications.
            </p>
            <div className="flex flex-col justify-center gap-4 sm:flex-row">
              <Button
                disabled={isLoading}
                onClick={() => handleTierSelect("pro")}
                size="lg"
                variant="secondary"
              >
                Start with Pro
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                className="border-primary-foreground bg-transparent text-primary-foreground hover:bg-primary-foreground hover:text-primary"
                size="lg"
                variant="outline"
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Sales
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
