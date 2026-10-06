import { hasAuthRole, type OrganizationRole } from "@beztack/auth";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { type MembershipContextValue, useOptionalMembership } from "@/contexts/membership-context";
import { getSignInPath } from "@/lib/auth-redirect";
import { authClient } from "@/lib/auth-client";

/** What a role-gated route can ask about the signed-in caller. */
export type RouteAccess = Pick<
  MembershipContextValue,
  "isAppAdmin" | "organizationRole" | "canManageBilling"
>;

export type ProtectedRouteProps = {
  children: ReactNode;
  /**
   * Organization roles admitted, matched exactly against the caller's role in
   * the Active organization. App admin does not count: it holds no
   * Organization role.
   */
  allowedRoles?: readonly OrganizationRole[];
  /** Extra access rule, e.g. the Billing manager gate. */
  allow?: (access: RouteAccess) => boolean;
};

function Loading() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <Loader2 aria-label="Loading" className="h-8 w-8 animate-spin" />
    </div>
  );
}

function isAllowed(
  access: RouteAccess | null,
  allowedRoles: readonly OrganizationRole[] | undefined,
  allow: ProtectedRouteProps["allow"],
): boolean {
  if (!(allowedRoles || allow)) {
    return true;
  }
  // A gated route outside a MembershipProvider has nothing to decide with.
  if (!access) {
    return false;
  }
  if (
    allowedRoles &&
    !allowedRoles.some((role) => hasAuthRole<string>(access.organizationRole, role))
  ) {
    return false;
  }
  return allow ? allow(access) : true;
}

export function ProtectedRoute({ children, allowedRoles, allow }: ProtectedRouteProps) {
  const { data, isPending } = authClient.useSession();
  const membership = useOptionalMembership();
  const navigate = useNavigate();
  const location = useLocation();

  const isGated = Boolean(allowedRoles || allow);
  const isDeciding =
    isPending || (isGated && Boolean(data) && membership?.isAccessLoading === true);
  const allowed = Boolean(data) && isAllowed(membership, allowedRoles, allow);

  useEffect(() => {
    if (isDeciding) {
      return;
    }
    if (!data) {
      navigate(getSignInPath(location), { replace: true });
    } else if (!allowed) {
      navigate("/", { replace: true });
    }
  }, [data, isDeciding, allowed, navigate, location]);

  if (isDeciding) {
    return <Loading />;
  }

  return allowed ? <>{children}</> : null;
}

/** Organization management: Organization admins (`admin`, `owner`) only. */
export function OrgAdminRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute allowedRoles={["admin", "owner"]}>{children}</ProtectedRoute>;
}

/** Billing pages: callers who pass the server's Billing manager gate. */
export function BillingManagerRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute allow={(access) => access.canManageBilling}>{children}</ProtectedRoute>;
}

/** Platform tools: App admins only (`sudo` AND allowlisted, decided by the API). */
export function AdminRoute({ children }: { children: ReactNode }) {
  return <ProtectedRoute allow={(access) => access.isAppAdmin}>{children}</ProtectedRoute>;
}
