import { env } from "@/env";
import { parseAppAdminEmails } from "./app-admin";

/** The `APP_ADMIN_EMAILS` allowlist from the environment, normalized. */
export function getAppAdminEmails(): string[] {
  return parseAppAdminEmails(env.APP_ADMIN_EMAILS);
}
