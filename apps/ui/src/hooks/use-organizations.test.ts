import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  setActive: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  useMutation: vi.fn((options: unknown) => options),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: mocks.useMutation,
  useQuery: vi.fn(),
  useQueryClient: () => ({
    invalidateQueries: mocks.invalidateQueries,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    organization: {
      acceptInvitation: vi.fn(),
      addTeamMember: vi.fn(),
      cancelInvitation: vi.fn(),
      create: vi.fn(),
      createTeam: vi.fn(),
      delete: vi.fn(),
      getFullOrganization: vi.fn(),
      inviteMember: vi.fn(),
      leave: vi.fn(),
      list: vi.fn(),
      listInvitations: vi.fn(),
      listMembers: vi.fn(),
      listTeamMembers: vi.fn(),
      listTeams: vi.fn(),
      rejectInvitation: vi.fn(),
      removeMember: vi.fn(),
      removeTeam: vi.fn(),
      removeTeamMember: vi.fn(),
      setActive: mocks.setActive,
      update: vi.fn(),
      updateMemberRole: vi.fn(),
    },
  },
}));

import { useCancelInvitation, useSetActiveOrganization } from "./use-organizations";

describe("useSetActiveOrganization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setActive.mockResolvedValue({ data: null });
  });

  it("invalidates organization-scoped subscription state when active organization changes", async () => {
    const mutation = useSetActiveOrganization() as unknown as {
      mutationFn: (organizationId: string) => Promise<unknown>;
      onSuccess: () => void;
    };

    await mutation.mutationFn("org_new");
    mutation.onSuccess();

    expect(mocks.setActive).toHaveBeenCalledWith({
      organizationId: "org_new",
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["activeOrganization"],
    });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["subscriptions"],
    });
  });
});

describe("useCancelInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("invalidates the organization invitation lists, not a key built from the invitation id", () => {
    const mutation = useCancelInvitation() as unknown as {
      onSuccess: (data: unknown, variables: { invitationId: string }) => void;
    };

    mutation.onSuccess(undefined, { invitationId: "inv_1" });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["organizationInvitations"],
    });
    expect(mocks.invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["organizationInvitations", "inv_1"],
    });
  });
});
