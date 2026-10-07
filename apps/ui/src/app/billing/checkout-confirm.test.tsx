import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/format", () => ({ formatPrice: (amount: number) => `$${amount}` }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

import { getPostSignInTarget } from "@/lib/auth-redirect";
import {
  getCheckoutConfirmPath,
  getSignUpPathForCheckout,
  readCheckoutSelection,
} from "@/lib/checkout-resume";
import type { PricingTier } from "@/types/pricing";
import { CheckoutConfirmView } from "./checkout-confirm";

const PRO: PricingTier = {
  id: "pro",
  name: "Pro",
  description: "For teams",
  price: { monthly: 20, yearly: 200 },
  monthly: { id: "prod_pro_month" } as PricingTier["monthly"],
  yearly: { id: "prod_pro_year" } as PricingTier["yearly"],
};

function render(props: Partial<Parameters<typeof CheckoutConfirmView>[0]>) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <CheckoutConfirmView
        isLoadingTiers={false}
        isStarting={false}
        onContinue={vi.fn()}
        selection={{ tierId: "pro", billingPeriod: "yearly" }}
        tier={PRO}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("Checkout resume after sign-up", () => {
  it("brings the visitor back to the plan they picked once signed up", () => {
    const signUpPath = getSignUpPathForCheckout({ tierId: "pro", billingPeriod: "yearly" });
    const afterSignUp = getPostSignInTarget(signUpPath.slice(signUpPath.indexOf("?")));

    expect(afterSignUp).toBe(getCheckoutConfirmPath({ tierId: "pro", billingPeriod: "yearly" }));
    expect(readCheckoutSelection(afterSignUp.slice(afterSignUp.indexOf("?")))).toEqual({
      tierId: "pro",
      billingPeriod: "yearly",
    });
  });

  it("rejects a malformed selection", () => {
    expect(readCheckoutSelection("?tier=pro&billingPeriod=weekly")).toBeNull();
    expect(readCheckoutSelection("?tier=%3Cscript%3E&billingPeriod=monthly")).toBeNull();
    expect(readCheckoutSelection("")).toBeNull();
  });

  it("shows the picked plan and Billing cadence with a way to continue", () => {
    const html = render({});

    expect(html).toContain("Pro");
    expect(html).toContain("$200 / billing.yearly");
    expect(html).toContain("billing.checkoutConfirm.continue");
    expect(html).not.toContain("billing.checkoutConfirm.unavailableTitle");
  });

  it("offers another plan when the picked one cannot be bought", () => {
    expect(render({ tier: undefined })).toContain("billing.checkoutConfirm.unavailableTitle");
    expect(render({ tier: { ...PRO, soon: true } })).toContain(
      "billing.checkoutConfirm.unavailableTitle",
    );
    expect(render({ selection: null })).not.toContain("billing.checkoutConfirm.continue");
  });
});
