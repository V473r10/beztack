# @beztack/auth

Role parsing, Organization role ranking and post-sign-in redirects shared by
`apps/api` and `apps/ui`, so both sides agree on roles.

```ts
import {
  getAuthRoles,
  getSafeRedirectTarget,
  hasAuthRole,
  hasOrganizationRoleAtLeast,
} from "@beztack/auth";

hasAuthRole(user.role, "sudo"); // exact match: "pseudo" never matches
getAuthRoles("user, sudo"); // ["user", "sudo"]; missing role -> ["user"]
hasOrganizationRoleAtLeast(member.role, "admin"); // member < admin < owner
getSafeRedirectTarget(searchParams.get("next"), "/"); // in-app paths only
```

- App roles: `sudo`, `user`. A derived project adds its own by widening the
  type parameter: `hasAuthRole<AppRole | "consumer">(role, "consumer")`.
- Organization roles, lowest first: `member`, `admin`, `owner`. A derived
  project with more roles builds its own ranking with
  `createOrganizationRoleRanking(["member", "rider", "admin", "owner"])`.
- `getSafeRedirectTarget` rejects absolute and protocol-relative URLs,
  backslashes, control characters and the `/auth` pages.

Built to `dist/` by `pnpm run build:packages` (root `postinstall`).
