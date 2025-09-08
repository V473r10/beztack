import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Toaster } from "sonner";
import { AI } from "./app/ai/ai.tsx";
import AdminDashboard from "./app/admin/admin.tsx";
import AdminAnalytics from "./app/admin/analytics.tsx";
// import { AdminLayout } from "./app/admin/components/admin-layout.tsx";
import UsersPage from "./app/admin/users.tsx";
import AuthLayout from "./app/auth/auth-layout.tsx";
import SignIn from "./app/auth/sign-in/sign-in.tsx";
import TwoFactor from "./app/auth/sign-in/two-factor/two-factor.tsx";
import SignUp from "./app/auth/sign-up/sign-up.tsx";
import Home from "./app/home/home.tsx";
import OCR from "./app/ocr/ocr.tsx";
import OrganizationsPage from "./app/organizations/organizations.tsx";
import Settings from "./app/settings/settings.tsx";
import Pricing from "./pages/pricing.tsx";
import Billing from "./pages/billing.tsx";
import CheckoutSuccess from "./pages/checkout-success.tsx";
import { AdminRoute } from "./components/admin-route.tsx";
import { MainLayout } from "./components/main-layout.tsx";
import { ProtectedRoute } from "./components/protected-route.tsx";
import { PublicRoute } from "./components/public-route.tsx";
import { ThemeProvider } from "./contexts/theme-context.tsx";
import { MembershipProvider } from "./contexts/membership-context.tsx";

function makeQueryClient() {
	return new QueryClient({
		defaultOptions: {
			queries: {
				// With SSR, we usually want to set some default staleTime
				// above 0 to avoid refetching immediately on the client
				staleTime: 60 * 1000,
			},
		},
	});
}
let browserQueryClient: QueryClient | undefined = undefined;
function getQueryClient() {
	if (typeof window === "undefined") {
		// Server: always make a new query client
		return makeQueryClient();
	}
	// Browser: make a new query client if we don't already have one
	// This is very important, so we don't re-make a new client if React
	// suspends during the initial render. This may not be needed if we
	// have a suspense boundary BELOW the creation of the query client
	if (!browserQueryClient) browserQueryClient = makeQueryClient();
	return browserQueryClient;
}

function App() {
	const queryClient = getQueryClient();
	return (
		<>
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
							<Route index element={<Home />} />
						</Route>
						<Route
							element={
								<ProtectedRoute>
									<MainLayout />
								</ProtectedRoute>
							}
						>
							<Route path="settings" element={<Settings />} />
						</Route>
						<Route
							element={
								<ProtectedRoute>
									<MainLayout />
								</ProtectedRoute>
							}
						>
							<Route path="organizations" element={<OrganizationsPage />} />
						</Route>
						<Route
							element={
								<ProtectedRoute>
									<MainLayout />
								</ProtectedRoute>
							}
						>
							<Route path="billing" element={<Billing />} />
						</Route>
						<Route
							path="admin"
							element={
								<AdminRoute>
									<MainLayout />
								</AdminRoute>
							}
						>
							<Route index element={<AdminDashboard />} />
							<Route path="users" element={<UsersPage />} />
							<Route path="analytics" element={<AdminAnalytics />} />
						</Route>
						<Route
							path="auth"
							element={
								<PublicRoute>
									<AuthLayout />
								</PublicRoute>
							}
						>
							<Route path="sign-in" element={<SignIn />} />
							<Route path="sign-in/two-factor" element={<TwoFactor />} />
							<Route path="sign-up" element={<SignUp />} />
							<Route index element={<Navigate to="sign-in" replace />} />
						</Route>
						<Route path="pricing" element={<Pricing />} />
						<Route path="checkout-success" element={<CheckoutSuccess />} />
						<Route path="ai" element={<AI />} />
						<Route path="ocr" element={<OCR />} />
						{/* Redirect any unknown routes to home */}
						<Route path="*" element={<Navigate to="/" replace />} />
					</Routes>
					</BrowserRouter>
					<Toaster />
				</MembershipProvider>
			</QueryClientProvider>
			</ThemeProvider>
		</>
	);
}

export default App;
