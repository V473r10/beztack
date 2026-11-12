/**
 * Guards that keep the public live demo (docs/demo.md) from reaching real
 * people. Pure, so tests need neither the env nor a running server.
 */
import type { SendEmailUnifiedProps } from "@beztack/email";

type SendEmail = (props: SendEmailUnifiedProps) => Promise<unknown>;

/** Routes that send mail to an address the caller names, without authentication. */
const EMAIL_ROUTE_PREFIX = "/api/email";

/**
 * In demo mode every email is dropped: visitors sign up with any address, so
 * nothing the app sends may leave it. Outside demo mode the real sender is
 * returned untouched.
 */
export function guardEmailSender(sendEmail: SendEmail, demoMode: boolean): SendEmail {
  if (!demoMode) {
    return sendEmail;
  }
  return async () => ({ success: true, skipped: "demo-mode" });
}

/** Whether a request path is one the demo must refuse (`/api/email/*`). */
export function isDemoBlockedPath(pathname: string): boolean {
  return pathname === EMAIL_ROUTE_PREFIX || pathname.startsWith(`${EMAIL_ROUTE_PREFIX}/`);
}
