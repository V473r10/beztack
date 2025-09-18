import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import AdminDashboard from "./app/admin/admin.tsx";
import AdminAnalytics from "./app/admin/analytics.tsx";
// import { AdminLayout } from "./app/admin/components/admin-layout.tsx";
import UsersPage from "./app/admin/users.tsx";
import { AI } from "./app/ai/ai.tsx";
import AuthLayout from "./app/auth/auth-layout.tsx";
import SignIn from "./app/auth/sign-in/sign-in.tsx";
import TwoFactor from "./app/auth/sign-in/two-factor/two-factor.tsx";
import SignUp from "./app/auth/sign-up/sign-up.tsx";
import Billing from "./app/billing/billing.tsx";
import CheckoutSuccess from "./app/billing/checkout-success.tsx";
import Pricing from "./app/billing/pricing.tsx";
import Home from "./app/home/home.tsx";
import OCR from "./app/ocr/ocr.tsx";
import OrganizationsPage from "./app/organizations/organizations.tsx";
import { Settings } from "./app/settings/settings.tsx";
import { AdminRoute } from "./components/admin-route.tsx";
import { MainLayout } from "./components/main-layout.tsx";
import { ProtectedRoute } from "./components/protected-route.tsx";
import { PublicRoute } from "./components/public-route.tsx";
import { MembershipProvider } from "./contexts/membership-context.tsx";
import { ThemeProvider } from "./contexts/theme-context.tsx";

// Constants
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const DEFAULT_STALE_TIME_MS = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND; // 60 seconds in milliseconds

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // With SSR, we usually want to set some default staleTime
        // above 0 to avoid refetching immediately on the client
        staleTime: DEFAULT_STALE_TIME_MS,
      },
    },
  });
}
let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

function App() {
  const queryClient = getQueryClient();
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MembershipProvider>
          <BrowserRouter>
            <Routes>
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route element={<Home />} index />
              </Route>
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route element={<Settings />} path="settings" />
              </Route>
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route element={<OrganizationsPage />} path="organizations" />
              </Route>
              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route element={<Billing />} path="billing" />
              </Route>
              <Route
                element={
                  <AdminRoute>
                    <MainLayout />
                  </AdminRoute>
                }
                path="admin"
              >
                <Route element={<AdminDashboard />} index />
                <Route element={<UsersPage />} path="users" />
                <Route element={<AdminAnalytics />} path="analytics" />
              </Route>
              <Route
                element={
                  <PublicRoute>
                    <AuthLayout />
                  </PublicRoute>
                }
                path="auth"
              >
                <Route element={<SignIn />} path="sign-in" />
                <Route element={<TwoFactor />} path="sign-in/two-factor" />
                <Route element={<SignUp />} path="sign-up" />
                <Route element={<Navigate replace to="sign-in" />} index />
              </Route>
              <Route element={<Pricing />} path="pricing" />
              <Route element={<CheckoutSuccess />} path="checkout-success" />
              <Route element={<AI />} path="ai" />
              <Route element={<OCR />} path="ocr" />
              {/* Redirect any unknown routes to home */}
              <Route element={<Navigate replace to="/" />} path="*" />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </MembershipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
