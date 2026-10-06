import { useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type InvitationPreview, useInvitationPreview } from "@/hooks/use-invitation-preview";
import { authClient } from "@/lib/auth-client";
import { getSignInPath } from "@/lib/auth-redirect";
import { formatDate } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";

const KNOWN_ROLES = new Set(["member", "admin", "owner"]);

/**
 * Invitation acceptance page, reached from the invitation email
 * (`/accept-invitation/:id`). Shows the Organization, the role, the status and
 * the expiry from the public preview; accepting needs a session, and
 * better-auth checks that the session's email is the invited one.
 */
export default function AcceptInvitation() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: session, isPending: isSessionPending } = authClient.useSession();
  const { data: invitation, isLoading, error } = useInvitationPreview(id);

  if (isSessionPending || isLoading) {
    return (
      <Centered>
        <Loader2 aria-label={t("invitation.loading")} className="h-8 w-8 animate-spin" />
      </Centered>
    );
  }

  if (!id || error || !invitation) {
    return <Unavailable message={t("invitation.notFound")} />;
  }

  if (invitation.status !== "pending") {
    const key = `invitation.status.${invitation.status}`;
    return <Unavailable message={t(key, { defaultValue: t("invitation.notFound") })} />;
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    return <Unavailable message={t("invitation.expired")} />;
  }

  return (
    <Centered>
      <Card className="w-full max-w-md">
        <InvitationHeader invitation={invitation} />
        <CardContent className="space-y-4">
          {session ? <InvitationActions invitation={invitation} /> : <SignInPrompt />}
        </CardContent>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">{children}</div>
  );
}

function InvitationHeader({ invitation }: { invitation: InvitationPreview }) {
  const { t } = useTranslation();
  const role = KNOWN_ROLES.has(invitation.role)
    ? t(`invitation.roles.${invitation.role}`)
    : invitation.role;

  return (
    <CardHeader className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {invitation.organization.logo ? (
          <img
            alt=""
            className="h-16 w-16 rounded-full object-cover"
            height={64}
            src={invitation.organization.logo}
            width={64}
          />
        ) : (
          <Building2 aria-hidden className="h-8 w-8" />
        )}
      </div>
      <CardTitle>{t("invitation.title", { organization: invitation.organization.name })}</CardTitle>
      <CardDescription>
        {t("invitation.role", { role })}{" "}
        {t("invitation.expires", { date: formatDate(invitation.expiresAt) })}
      </CardDescription>
    </CardHeader>
  );
}

function SignInPrompt() {
  const { t } = useTranslation();
  const location = useLocation();
  // Both auth pages send the user back here once they have a session.
  const signInPath = getSignInPath(location);
  const signUpPath = signInPath.replace("/auth/sign-in", "/auth/sign-up");

  return (
    <>
      <p className="text-center text-muted-foreground text-sm">{t("invitation.signInPrompt")}</p>
      <div className="flex gap-2">
        <Button asChild className="flex-1">
          <Link to={signInPath}>{t("invitation.signIn")}</Link>
        </Button>
        <Button asChild className="flex-1" variant="outline">
          <Link to={signUpPath}>{t("invitation.signUp")}</Link>
        </Button>
      </div>
    </>
  );
}

type OrganizationInvitationClient = {
  acceptInvitation(input: {
    invitationId: string;
  }): Promise<{ data: { member: { organizationId: string } } | null; error: unknown }>;
  setActive(input: { organizationId: string }): Promise<unknown>;
};

/**
 * Accept the Invitation and make its Organization the Active organization.
 * Returns the joined Organization id, or `null` when better-auth refused (for
 * example the session's email is not the invited one).
 */
export async function joinOrganization(
  client: OrganizationInvitationClient,
  invitationId: string,
): Promise<string | null> {
  const { data, error } = await client.acceptInvitation({ invitationId });
  if (error || !data) {
    return null;
  }
  const organizationId = data.member.organizationId;
  await client.setActive({ organizationId });
  return organizationId;
}

function InvitationActions({ invitation }: { invitation: InvitationPreview }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);
  const [failed, setFailed] = useState(false);

  const refreshOrganizations = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.list() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.userInvitations() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.organizations.active() }),
    ]);
  };

  const accept = async () => {
    setPending("accept");
    setFailed(false);
    const joined = await joinOrganization(authClient.organization, invitation.id);
    setPending(null);
    if (!joined) {
      setFailed(true);
      return;
    }
    await refreshOrganizations();
    toast.success(t("invitation.accepted", { organization: invitation.organization.name }));
    navigate("/", { replace: true });
  };

  const decline = async () => {
    setPending("decline");
    setFailed(false);
    const { error } = await authClient.organization.rejectInvitation({
      invitationId: invitation.id,
    });
    setPending(null);
    if (error) {
      setFailed(true);
      return;
    }
    await refreshOrganizations();
    toast.success(t("invitation.declined"));
    navigate("/", { replace: true });
  };

  const signOut = async () => {
    await authClient.signOut();
    navigate(0);
  };

  return (
    <>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={pending !== null} onClick={accept}>
          {pending === "accept" && <Loader2 aria-hidden className="mr-2 h-4 w-4 animate-spin" />}
          {t("invitation.accept")}
        </Button>
        <Button className="flex-1" disabled={pending !== null} onClick={decline} variant="outline">
          {t("invitation.decline")}
        </Button>
      </div>
      {failed && (
        <div className="space-y-2" role="alert">
          <p className="text-center text-destructive text-sm">{t("invitation.actionFailed")}</p>
          <p className="text-center text-muted-foreground text-sm">
            {t("invitation.wrongAccount")}{" "}
            <button className="underline" onClick={signOut} type="button">
              {t("invitation.signOut")}
            </button>
          </p>
        </div>
      )}
    </>
  );
}

function Unavailable({ message }: { message: string }) {
  const { t } = useTranslation();
  return (
    <Centered>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t("invitation.unavailableTitle")}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link to="/">{t("invitation.goHome")}</Link>
          </Button>
        </CardContent>
      </Card>
    </Centered>
  );
}
