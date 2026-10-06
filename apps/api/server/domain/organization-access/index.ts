// Callers import this directory. Tests import `./testing` or
// `./implementation` directly: this file loads the production adapter, which
// pulls in `@beztack/db` and `@/env`.
export * from "./contract";
export { getAppAdminEmails, organizationAccess } from "./production";
