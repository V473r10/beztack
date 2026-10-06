import { getSafeRedirectTarget } from "@beztack/auth";

const SIGN_IN_PATH = "/auth/sign-in";
const HOME_PATH = "/";

type LocationLike = {
  pathname: string;
  search: string;
  hash: string;
};

function readSafeNext(search: string): string | null {
  const next = new URLSearchParams(search).get("next");
  const safeNext = getSafeRedirectTarget(next, "");
  return safeNext && safeNext !== HOME_PATH ? safeNext : null;
}

function appendNext(path: string, next: string | null): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/** Sign-in path that returns the user to `location` once signed in. */
export function getSignInPath(location: LocationLike): string {
  const target = `${location.pathname}${location.search}${location.hash}`;
  const safeTarget = getSafeRedirectTarget(target, "");
  return appendNext(SIGN_IN_PATH, safeTarget && safeTarget !== HOME_PATH ? safeTarget : null);
}

/** Where to go after sign-in: the safe `next` from `search`, or home. */
export function getPostSignInTarget(search: string): string {
  return readSafeNext(search) ?? HOME_PATH;
}

/** `path` with the safe `next` from `search` carried over, for multi-step sign-in. */
export function withNext(path: string, search: string): string {
  return appendNext(path, readSafeNext(search));
}
