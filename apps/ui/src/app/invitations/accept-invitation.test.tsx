import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: { data: null as unknown, isPending: false },
  preview: { data: undefined as unknown, isLoading: false, error: null as unknown },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => mocks.session, organization: {}, signOut: vi.fn() },
}));
vi.mock("@/hooks/use-invitation-preview", () => ({
  useInvitationPreview: () => mocks.preview,
}));
vi.mock("@/lib/format", () => ({ formatDate: () => "Nov 1, 2026" }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({}) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useLocation: () => ({ pathname: "/accept-invitation/inv_1", search: "", hash: "" }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: "inv_1" }),
}));
// Keys and interpolation values are what the page decides; translations are data.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}(${Object.values(values).join(",")})` : key,
  }),
}));

import AcceptInvitation, { joinOrganization } from "./accept-invitation";

const PENDING = {
  id: "inv_1",
  role: "admin",
  status: "pending",
  expiresAt: "2999-01-01T00:00:00.000Z",
  organization: { name: "Acme", logo: "https://cdn.example.test/acme.png" },
};

function preview(data: unknown) {
  mocks.preview = { data, isLoading: false, error: null };
}

const render = () => renderToStaticMarkup(<AcceptInvitation />);

describe("AcceptInvitation page", () => {
  beforeEach(() => {
    mocks.session = { data: null, isPending: false };
    preview(PENDING);
  });

  it("shows the organization, its logo, the role and the expiry", () => {
    const html = render();

    expect(html).toContain("invitation.title(Acme)");
    expect(html).toContain('src="https://cdn.example.test/acme.png"');
    expect(html).toContain("invitation.role(invitation.roles.admin)");
    expect(html).toContain("invitation.expires(Nov 1, 2026)");
  });

  it("asks a signed-out visitor to sign in or sign up and come back", () => {
    const html = render();

    expect(html).toContain('href="/auth/sign-in?next=%2Faccept-invitation%2Finv_1"');
    expect(html).toContain('href="/auth/sign-up?next=%2Faccept-invitation%2Finv_1"');
    expect(html).not.toContain("invitation.accept<");
  });

  it("offers accept and decline once signed in", () => {
    mocks.session = { data: { user: { id: "user_1" } }, isPending: false };
    const html = render();

    expect(html).toContain("invitation.accept");
    expect(html).toContain("invitation.decline");
    expect(html).not.toContain("invitation.signIn");
  });

  it.each([
    ["accepted", "invitation.status.accepted"],
    ["rejected", "invitation.status.rejected"],
    ["canceled", "invitation.status.canceled"],
  ])("explains a %s invitation instead of offering it", (status, key) => {
    preview({ ...PENDING, status });

    const html = render();
    expect(html).toContain(key);
    expect(html).not.toContain("invitation.accept");
  });

  it("explains an expired invitation", () => {
    preview({ ...PENDING, expiresAt: "2000-01-01T00:00:00.000Z" });

    expect(render()).toContain("invitation.expired");
  });

  it("explains an unknown invitation", () => {
    mocks.preview = { data: undefined, isLoading: false, error: new Error("404") };

    expect(render()).toContain("invitation.notFound");
  });
});

describe("joinOrganization", () => {
  it("accepts the invitation and makes its Organization the Active organization", async () => {
    const client = {
      acceptInvitation: vi.fn(async () => ({
        data: { member: { organizationId: "org_1" } },
        error: null,
      })),
      setActive: vi.fn(async () => undefined),
    };

    await expect(joinOrganization(client, "inv_1")).resolves.toBe("org_1");
    expect(client.acceptInvitation).toHaveBeenCalledWith({ invitationId: "inv_1" });
    expect(client.setActive).toHaveBeenCalledWith({ organizationId: "org_1" });
  });

  it("reports a refusal (e.g. another account) without switching organization", async () => {
    const client = {
      acceptInvitation: vi.fn(async () => ({ data: null, error: { status: 403 } })),
      setActive: vi.fn(async () => undefined),
    };

    await expect(joinOrganization(client, "inv_1")).resolves.toBeNull();
    expect(client.setActive).not.toHaveBeenCalled();
  });
});
