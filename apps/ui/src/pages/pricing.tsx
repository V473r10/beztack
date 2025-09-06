import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ArrowRight, Mail, X } from "lucide-react";
import { PricingCard } from "@/components/payments/pricing-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useMembership } from "@/contexts/membership-context";
import type { PolarPricingTier } from "@/types/polar-pricing";
import { z } from "zod";
import { usePolarProducts } from "./usePolarProducts";
import { useTranslation } from "react-i18next";

// Feature schema for DataTable
const featureSchema = z.object({
  id: z.number(),
  category: z.string(),
  feature: z.string(),
  basic: z.boolean().or(z.string()),
  pro: z.boolean().or(z.string()),
  ultimate: z.boolean().or(z.string()),
});

type FeatureRow = z.infer<typeof featureSchema>;

// Feature cell component to render boolean/string values appropriately
function FeatureCell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return (
      <div className="text-center">
        {value ? (
          <Check className="h-4 w-4 mx-auto text-green-600" />
        ) : (
          <X className="h-4 w-4 mx-auto text-muted-foreground" />
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
            <TableCell><FeatureCell value={feature.basic} /></TableCell>
            <TableCell><FeatureCell value={feature.pro} /></TableCell>
            <TableCell><FeatureCell value={feature.ultimate} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const { currentTier, upgradeToTier, isLoading } = useMembership();
  const { t } = useTranslation();

  const { data: allTiers = [], isLoading: isLoadingTiers } = useQuery<PolarPricingTier[]>({
    queryKey: ['polar-products'],
    queryFn: usePolarProducts,
  });

  // Generate feature comparison data from API response
  const groupedFeatures = useMemo(() => {
    if (!allTiers.length) return {};

    const categories: Record<string, FeatureRow[]> = {};
    let featureId = 1;

    // Get all unique features from all tiers
    const allFeatures = new Set<string>();
    const allLimits = new Set<string>();
    const allPermissions = new Set<string>();

    allTiers.forEach(tier => {
      tier.features?.forEach(feature => allFeatures.add(feature));
      Object.keys(tier.limits || {}).forEach(limit => allLimits.add(limit));
      tier.permissions?.forEach(permission => allPermissions.add(permission));
    });

    // Process features
    allFeatures.forEach(feature => {
      const category = t('pricing.categories.features');
      if (!categories[category]) categories[category] = [];
      
      const featureRow: FeatureRow = {
        id: featureId++,
        category,
        feature: t(`pricing.features.${feature}`, feature),
        basic: allTiers.find(t => t.id === 'basic')?.features?.includes(feature) || false,
        pro: allTiers.find(t => t.id === 'pro')?.features?.includes(feature) || false,
        ultimate: allTiers.find(t => t.id === 'ultimate')?.features?.includes(feature) || false,
      };
      categories[category].push(featureRow);
    });

    // Process limits
    allLimits.forEach(limit => {
      const category = t('pricing.categories.limits');
      if (!categories[category]) categories[category] = [];
      
      const basicTier = allTiers.find(t => t.id === 'basic');
      const proTier = allTiers.find(t => t.id === 'pro');
      const ultimateTier = allTiers.find(t => t.id === 'ultimate');
      
      const formatLimitValue = (value: number | undefined) => {
        if (value === undefined) return false;
        if (value === -1 || value === 999999) return t('pricing.unlimited');
        return value.toLocaleString();
      };

      const featureRow: FeatureRow = {
        id: featureId++,
        category,
        feature: t(`pricing.limits.${limit}`, limit),
        basic: formatLimitValue(basicTier?.limits?.[limit]),
        pro: formatLimitValue(proTier?.limits?.[limit]),
        ultimate: formatLimitValue(ultimateTier?.limits?.[limit]),
      };
      categories[category].push(featureRow);
    });

    // Process permissions
    allPermissions.forEach(permission => {
      const category = t('pricing.categories.features');
      if (!categories[category]) categories[category] = [];
      
      const featureRow: FeatureRow = {
        id: featureId++,
        category,
        feature: t(`pricing.permissions.${permission}`, permission),
        basic: allTiers.find(t => t.id === 'basic')?.permissions?.includes(permission) || false,
        pro: allTiers.find(t => t.id === 'pro')?.permissions?.includes(permission) || false,
        ultimate: allTiers.find(t => t.id === 'ultimate')?.permissions?.includes(permission) || false,
      };
      categories[category].push(featureRow);
    });

    return categories;
  }, [allTiers, t]);

  const handleTierSelect = async (tierId: string) => {
    try {
      await upgradeToTier(tierId, billingPeriod);
    } catch (error) {
      console.error("Failed to upgrade:", error);
    }
  };

  const faqItems = [
    {
      question: "Can I change my plan anytime?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the billing accordingly."
    },
    {
      question: "What happens to my data if I downgrade?",
      answer: "Your data remains safe. If you exceed the limits of a lower plan, you'll have read-only access to the excess data until you upgrade again or reduce usage."
    },
    {
      question: "Do you offer refunds?",
      answer: "We offer a 30-day money-back guarantee for annual plans. Monthly subscriptions can be canceled anytime without penalty."
    },
    {
      question: "Is there a setup fee?",
      answer: "No, there are no setup fees or hidden charges. You only pay for the plan you choose."
    },
    {
      question: "How does billing work for teams?",
      answer: "Team plans are billed per organization. All members within the organization share the plan limits and features."
    },
    {
      question: "Can I try before I buy?",
      answer: "Yes! Start with our free plan to explore the basics, then upgrade when you're ready for more advanced features."
    },
  ];

  return (
    <div className="container mx-auto px-4 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Choose the perfect plan for your needs. Upgrade or downgrade at any time.
        </p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center mb-4">
          <Tabs 
            value={billingPeriod} 
            onValueChange={(value) => setBillingPeriod(value as "monthly" | "yearly")}
            className="w-fit"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly" className="relative">
                Yearly
                <Badge 
                  variant="secondary" 
                  className="ml-2 h-5 px-1.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                >
                  Save 17%
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {billingPeriod === "yearly" && (
          <p className="text-sm text-muted-foreground">
            Get 2 months free with annual billing
          </p>
        )}
      </div>

      {/* Pricing Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 mb-16">
        {isLoadingTiers ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="relative">
              <CardContent className="p-6">
                <div className="animate-pulse">
                  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                  <div className="h-2 bg-muted rounded w-full mb-4"></div>
                  <div className="h-8 bg-muted rounded w-1/2 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-2 bg-muted rounded"></div>
                    <div className="h-2 bg-muted rounded"></div>
                    <div className="h-2 bg-muted rounded"></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          allTiers.map((tier) => (
            <PricingCard
              key={tier.id}
              tier={tier}
              billingPeriod={billingPeriod}
              currentTier={currentTier}
              isPopular={tier.id === "pro"}
              onSelect={handleTierSelect}
              isLoading={isLoading}
            />
          ))
        )}
      </div>

      {/* Feature Comparison Table */}
      <div className="mb-16">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Compare features</h2>
          <p className="text-muted-foreground">
            See exactly what's included in each plan
          </p>
        </div>
        
        {/* Render features grouped by category */}
        <div className="space-y-8">
          {Object.entries(groupedFeatures).map(([category, features]) => (
            <Card key={category}>
              <CardContent className="p-0">
                <div className="bg-muted/30 p-4 border-b">
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
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4">Frequently asked questions</h2>
          <p className="text-muted-foreground">
            Have questions? We've got answers.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {faqItems.map((item, index) => (
            <Card key={index}>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-2">{item.question}</h3>
                <p className="text-sm text-muted-foreground">{item.answer}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold mb-4">
              Ready to get started?
            </h2>
            <p className="text-lg mb-6 opacity-90">
              Join thousands of teams already using nvn to secure their applications.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="secondary" 
                size="lg"
                onClick={() => handleTierSelect("pro")}
                disabled={isLoading}
              >
                Start with Pro
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
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