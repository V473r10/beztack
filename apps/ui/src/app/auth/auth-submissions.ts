import type { TFunction } from "i18next";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { getAuthErrorMessage, readAuthError } from "@/lib/auth-error-messages";
import { getPostSignInTarget, withNext } from "@/lib/auth-redirect";

/**
 * Submissions of the auth forms (sign-up, sign-in, two-factor).
 *
 * The Better Auth client resolves to `{ data, error }` instead of throwing, so
 * each submission reads `error` explicitly. On failure it shows a translated
 * toast, does not navigate, and returns the message so the form can also show
 * it inline. On success it returns null.
 */

type SubmissionDeps = {
  t: TFunction;
  navigate: (to: string) => void;
};

type AuthResult = { data?: unknown; error?: unknown };

type SignUpValues = { name: string; email: string; password: string };
type SignInValues = { email: string; password: string };

const BACKUP_CODE_DASH = "-";

/** Runs one auth request and returns its result, turning a throw into an error result. */
async function request(call: () => Promise<unknown>): Promise<AuthResult> {
  try {
    return (await call()) as AuthResult;
  } catch {
    return { error: {} };
  }
}

function fail(t: TFunction, result: AuthResult, fallbackKey?: string): string {
  const message = getAuthErrorMessage(t, readAuthError(result) ?? {}, fallbackKey);
  toast.error(message);
  return message;
}

export async function submitSignUp(
  values: SignUpValues,
  search: string,
  { t, navigate }: SubmissionDeps,
): Promise<string | null> {
  const result = await request(() =>
    authClient.signUp.email({ name: values.name, email: values.email, password: values.password }),
  );
  if (readAuthError(result)) {
    return fail(t, result);
  }
  toast.success(t("notifications.account.created"));
  // Back to where sign-up started (e.g. an invitation), or home.
  navigate(getPostSignInTarget(search));
  return null;
}

export async function submitSignIn(
  values: SignInValues,
  search: string,
  { t, navigate }: SubmissionDeps,
): Promise<string | null> {
  const result = await request(() =>
    authClient.signIn.email({ email: values.email, password: values.password }),
  );
  if (readAuthError(result)) {
    return fail(t, result);
  }
  if ((result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
    toast.success(t("notifications.auth.twoFactorRequired"));
    navigate(withNext("/auth/sign-in/two-factor", search));
  } else {
    toast.success(t("notifications.auth.signInSuccess"));
    navigate(getPostSignInTarget(search));
  }
  return null;
}

export async function submitTotp(
  code: string,
  search: string,
  { t, navigate }: SubmissionDeps,
): Promise<string | null> {
  const result = await request(() => authClient.twoFactor.verifyTotp({ code }));
  if (readAuthError(result)) {
    return fail(t, result);
  }
  toast.success(t("notifications.auth.signIn2FASuccess"));
  navigate(getPostSignInTarget(search));
  return null;
}

export async function submitBackupCode(
  code: string,
  search: string,
  { t, navigate }: SubmissionDeps,
): Promise<string | null> {
  // Try the dashed format first (as the API issues it), then without the dash.
  let result = await request(() => authClient.twoFactor.verifyBackupCode({ code }));
  if (readAuthError(result)) {
    const withoutDash = code.replace(BACKUP_CODE_DASH, "");
    result = await request(() => authClient.twoFactor.verifyBackupCode({ code: withoutDash }));
  }
  if (readAuthError(result)) {
    return fail(t, result, "notifications.twoFactor.errors.verificationFailed");
  }
  toast.success(t("notifications.auth.signInBackupSuccess"));
  navigate(getPostSignInTarget(search));
  return null;
}
