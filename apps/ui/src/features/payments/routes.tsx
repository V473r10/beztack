import type { RouteObject } from "react-router";
import Billing from "../../app/billing/billing.tsx";
import CheckoutSuccess from "../../app/billing/checkout-success.tsx";
import Pricing from "../../app/billing/pricing.tsx";
import { MainLayout } from "../../components/main-layout.tsx";
import { ProtectedRoute } from "../../components/protected-route.tsx";

/**
 * Payments Routes
 *
 * Payment-related routes including pricing, billing, and checkout success.
 */
export const PaymentsRoutes: RouteObject[] = [
  {
    path: "billing",
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <Billing /> }],
  },
  {
    path: "pricing",
    element: <Pricing />,
  },
  {
    path: "checkout-success",
    element: <CheckoutSuccess />,
  },
];
