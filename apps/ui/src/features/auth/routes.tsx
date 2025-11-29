import type { RouteObject } from "react-router";
import { Navigate } from "react-router";
import AuthLayout from "../../app/auth/auth-layout.tsx";
import SignIn from "../../app/auth/sign-in/sign-in.tsx";
import TwoFactor from "../../app/auth/sign-in/two-factor/two-factor.tsx";
import SignUp from "../../app/auth/sign-up/sign-up.tsx";
import { PublicRoute } from "../../components/public-route.tsx";

/**
 * Auth Routes
 *
 * Authentication routes including sign-in, sign-up, and two-factor authentication.
 * These routes are wrapped in PublicRoute to redirect authenticated users.
 */
export const AuthRoutes: RouteObject[] = [
  {
    path: "auth",
    element: (
      <PublicRoute>
        <AuthLayout />
      </PublicRoute>
    ),
    children: [
      { path: "sign-in", element: <SignIn /> },
      { path: "sign-in/two-factor", element: <TwoFactor /> },
      { path: "sign-up", element: <SignUp /> },
      { index: true, element: <Navigate replace to="sign-in" /> },
    ],
  },
];
