import { useQuery } from "@tanstack/react-query";
import { requestJson } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

/** What the public preview endpoint returns. Never an email address. */
export type InvitationPreview = {
  id: string;
  role: string;
  status: "pending" | "accepted" | "rejected" | "canceled" | string;
  expiresAt: string;
  organization: { name: string; logo: string | null };
};

export function useInvitationPreview(invitationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.invitationPreview(invitationId),
    queryFn: () => requestJson<InvitationPreview>(`/api/invitations/${invitationId}`),
    enabled: Boolean(invitationId),
    retry: false,
  });
}
