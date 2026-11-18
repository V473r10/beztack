/** Public links every redesign points at. They fall back to the real Beztack hosts. */
export const links = {
  docs: "/docs",
  quickStart: "/docs/getting-started",
  payments: "/docs/payments/payments-core",
  planChanges: "/docs/payments/plan-changes",
  auth: "/docs/authentication/better-auth",
  architecture: "/docs/architecture",
  llms: "/llms-full.txt",
  demo: process.env.NEXT_PUBLIC_LIVE_DEMO_URL ?? "https://app.beztack.com",
  repo: process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/V473r10/beztack",
} as const;

export const CREATE_COMMAND = "pnpm create beztack";
