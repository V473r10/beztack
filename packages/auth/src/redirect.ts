/** Auth pages; sending a signed-in user back to them would loop. */
const AUTH_PATH_PREFIX = "/auth";

// Browsers drop tab and newline characters from URLs and read a backslash as
// a slash, so "/\t/evil.example" and "/\\evil.example" leave the app.
const LAST_CONTROL_CHARACTER = 0x1f;
const DELETE_CHARACTER = 0x7f;

function hasUnsafeCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= LAST_CONTROL_CHARACTER || code === DELETE_CHARACTER || character === "\\") {
      return true;
    }
  }
  return false;
}

/**
 * Return `next` when it is a safe in-app path, otherwise `fallback`.
 *
 * Rejected: missing values, absolute URLs, protocol-relative (`//host`) URLs,
 * backslashes and control characters, and the auth pages themselves.
 */
export function getSafeRedirectTarget(next: string | null | undefined, fallback: string): string {
  if (!next?.startsWith("/") || next.startsWith("//") || hasUnsafeCharacter(next)) {
    return fallback;
  }

  const isAuthPage =
    next === AUTH_PATH_PREFIX ||
    next.startsWith(`${AUTH_PATH_PREFIX}/`) ||
    next.startsWith(`${AUTH_PATH_PREFIX}?`) ||
    next.startsWith(`${AUTH_PATH_PREFIX}#`);

  return isAuthPage ? fallback : next;
}
