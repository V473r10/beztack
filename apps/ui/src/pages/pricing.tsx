import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ArrowRight, Mail } from "lucide-react";
import { PricingCard } from "@/components/payments/pricing-card";
import { useMembership } from "@/contexts/membership-context";
import type { PolarPricingTier } from "@/types/polar-pricing";

// Default features by tier - can be moved to Polar benefits later
const DEFAULT_FEATURES = {
  basic: [
    "Email/password authentication",
    "Basic dashboard access", 
    "Community support",
    "API access"
  ],
  pro: [
    "All Basic features",
    "Advanced analytics",
    "Priority email support", 
    "Team collaboration",
    "Export data"
  ],
  ultimate: [
    "All Pro features",
    "Custom integrations",
    "Dedicated support",
    "Advanced security",
    "Unlimited storage",
    "SLA guarantees"
  ]
};

const DEFAULT_LIMITS = {
  basic: { users: 1, storage: 5, apiCalls: 1000 },
  pro: { users: 5, storage: 50, apiCalls: 10000 },
  ultimate: { users: -1, storage: -1, apiCalls: -1 }
};

async function fetchPolarProducts(): Promise<PolarPricingTier[]> {
  try {
    const response = await fetch(`${process.env.VITE_API_URL}/api/polar/products`);
    const polarTiers = await response.json();
    
    // Use Polar data directly, add default features and limits
    const tiersWithDefaults = polarTiers.map((tier: PolarPricingTier) => ({
      ...tier,
      features: DEFAULT_FEATURES[tier.id as keyof typeof DEFAULT_FEATURES] || [],
      limits: DEFAULT_LIMITS[tier.id as keyof typeof DEFAULT_LIMITS] || {}
    }));
    
    return tiersWithDefaults;
  } catch (error) {
    console.error('Failed to fetch Polar products:', error);
    // Return empty array on error - no fallback to hardcoded data
    return [];
  }
}

export default function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const { currentTier, upgradeToTier, isLoading } = useMembership();
  
  const { data: allTiers = [], isLoading: isLoadingTiers } = useQuery<PolarPricingTier[]>({
    queryKey: ['polar-products'],
    queryFn: fetchPolarProducts,
  });

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {isLoadingTiers ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, index) => (
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
        
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">Features</th>
                    {allTiers.map((tier) => (
                      <th key={tier.id} className="text-center p-4 font-medium">
                        {tier.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Authentication Features */}
                  <tr className="border-b bg-muted/30">
                    <td className="p-4 font-medium">Authentication</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">Email/Password Login</td>
                    {allTiers.map((tier) => (
                      <td key={tier.id} className="text-center p-4">
                        <Check className="h-4 w-4 mx-auto text-green-600" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">Social Login</td>
                    {allTiers.map((tier) => (
                      <td key={tier.id} className="text-center p-4">
                        <Check className="h-4 w-4 mx-auto text-green-600" />
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">Two-Factor Authentication</td>
                    <td className="text-center p-4">—</td>
                    {allTiers.slice(1).map((tier) => (
                      <td key={tier.id} className="text-center p-4">
                        <Check className="h-4 w-4 mx-auto text-green-600" />
                      </td>
                    ))}
                  </tr>
                  
                  {/* Limits */}
                  <tr className="border-b bg-muted/30">
                    <td className="p-4 font-medium">Limits</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">Storage</td>
                    {allTiers.map((tier) => (
                      <td key={tier.id} className="text-center p-4">
                        {tier.limits?.storage === -1 ? "Unlimited" : `${tier.limits?.storage}GB`}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">API Calls/Month</td>
                    {allTiers.map((tier) => (
                      <td key={tier.id} className="text-center p-4">
                        {tier.limits?.apiCalls === -1 ? "Unlimited" : tier.limits?.apiCalls?.toLocaleString()}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">Team Members</td>
                    {allTiers.map((tier) => (
                      <td key={tier.id} className="text-center p-4">
                        {tier.limits?.users === -1 ? "Unlimited" : tier.limits?.users}
                      </td>
                    ))}
                  </tr>
                  
                  {/* Support */}
                  <tr className="border-b bg-muted/30">
                    <td className="p-4 font-medium">Support</td>
                    <td></td>
                    <td></td>
                    <td></td>
                    <td></td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">Community Support</td>
                    <td className="text-center p-4">
                      <Check className="h-4 w-4 mx-auto text-green-600" />
                    </td>
                    <td className="text-center p-4">
                      <Check className="h-4 w-4 mx-auto text-green-600" />
                    </td>
                    <td className="text-center p-4">
                      <Check className="h-4 w-4 mx-auto text-green-600" />
                    </td>
                    <td className="text-center p-4">
                      <Check className="h-4 w-4 mx-auto text-green-600" />
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="p-4 pl-8">Email Support</td>
                    <td className="text-center p-4">—</td>
                    <td className="text-center p-4">
                      <Check className="h-4 w-4 mx-auto text-green-600" />
                    </td>
                    <td className="text-center p-4">
                      <Check className="h-4 w-4 mx-auto text-green-600" />
                    </td>
                    <td className="text-center p-4">
                      <Check className="h-4 w-4 mx-auto text-green-600" />
                    </td>
                  </tr>
                  <tr>
                    <td className="p-4 pl-8">Priority Support & SLA</td>
                    <td className="text-center p-4">—</td>
                    <td className="text-center p-4">—</td>
                    <td className="text-center p-4">—</td>
                    <td className="text-center p-4">
                      <Check className="h-4 w-4 mx-auto text-green-600" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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