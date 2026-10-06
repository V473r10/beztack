import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { data: { user: { id: "user_1" } } as unknown, isPending: false },
  membership: null as null | {
    isAppAdmin: boolean;
    organizationRole: string | null;
    canManageBilling: boolean;
    isAccessLoading: boolean;
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => mocks.session },
}));
vi.mock("@/contexts/membership-context", () => ({
  useOptionalMembership: () => mocks.membership,
}));
vi.mock("@/lib/auth-redirect", () => ({ getSignInPath: () => "/auth/sign-in" }));
vi.mock("react-router", () => ({
  useLocation: () => ({ pathname: "/billing", search: "" }),
  useNavigate: () => vi.fn(),
}));

import { AdminRoute, BillingManagerRoute, OrgAdminRoute, ProtectedRoute } from "./protected-route";

type Access = NonNullable<typeof mocks.membership>;

function as(access: Partial<Access>) {
  mocks.membership = {
    isAppAdmin: false,
    organizationRole: null,
    canManageBilling: false,
    isAccessLoading: false,
    ...access,
  };
}

const PAGE = <p>secret page</p>;
const render = (element: React.ReactElement) => renderToStaticMarkup(element);

describe("role-gated routes", () => {
  beforeEach(() => {
    mocks.session = { data: { user: { id: "user_1" } }, isPending: false };
    as({});
  });

  it("OrgAdminRoute shows organization management to admins and owners only", () => {
    as({ organizationRole: "member" });
    expect(render(<OrgAdminRoute>{PAGE}</OrgAdminRoute>)).not.toContain("secret page");

    as({ organizationRole: "admin" });
    expect(render(<OrgAdminRoute>{PAGE}</OrgAdminRoute>)).toContain("secret page");

    as({ organizationRole: "owner" });
    expect(render(<OrgAdminRoute>{PAGE}</OrgAdminRoute>)).toContain("secret page");
  });

  it("OrgAdminRoute refuses an App admin who is not an Organization admin", () => {
    as({ isAppAdmin: true, organizationRole: null, canManageBilling: true });

    expect(render(<OrgAdminRoute>{PAGE}</OrgAdminRoute>)).not.toContain("secret page");
  });

  it("BillingManagerRoute follows the server's Billing manager gate", () => {
    as({ organizationRole: "member", canManageBilling: false });
    expect(render(<BillingManagerRoute>{PAGE}</BillingManagerRoute>)).not.toContain("secret page");

    as({ organizationRole: "owner", canManageBilling: true });
    expect(render(<BillingManagerRoute>{PAGE}</BillingManagerRoute>)).toContain("secret page");
  });

  it("AdminRoute needs the App admin answer from the API, not the sudo role", () => {
    as({ isAppAdmin: false, organizationRole: "owner", canManageBilling: true });
    expect(render(<AdminRoute>{PAGE}</AdminRoute>)).not.toContain("secret page");

    as({ isAppAdmin: true });
    expect(render(<AdminRoute>{PAGE}</AdminRoute>)).toContain("secret page");
  });

  it("waits for the access answer before deciding", () => {
    as({ organizationRole: "owner", isAccessLoading: true });

    const html = render(<OrgAdminRoute>{PAGE}</OrgAdminRoute>);
    expect(html).not.toContain("secret page");
    expect(html).toContain("Loading");
  });

  it("an ungated ProtectedRoute only needs a session", () => {
    mocks.membership = null;
    expect(render(<ProtectedRoute>{PAGE}</ProtectedRoute>)).toContain("secret page");

    mocks.session = { data: null, isPending: false };
    expect(render(<ProtectedRoute>{PAGE}</ProtectedRoute>)).not.toContain("secret page");
  });

  it("a gated route outside a MembershipProvider renders nothing", () => {
    mocks.membership = null;

    expect(render(<BillingManagerRoute>{PAGE}</BillingManagerRoute>)).not.toContain("secret page");
  });
});
