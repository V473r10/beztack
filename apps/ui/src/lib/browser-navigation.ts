/**
 * Leave the app for an external page (provider checkout, hosted billing).
 *
 * Every external redirect goes through this one function so tests can mock it
 * instead of fighting `window.location`. Ported from lncd
 * `apps/ui/src/lib/browser-navigation.ts`.
 */
export function redirectToExternalUrl(url: string): void {
  window.location.href = url;
}
