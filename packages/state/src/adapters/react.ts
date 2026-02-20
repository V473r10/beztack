/**
 * React SPA Adapter (for Vite, CRA, etc.)
 *
 * Wrap your app with NuqsAdapter in your root file:
 *
 * @example
 * ```tsx
 * import { NuqsAdapter } from '@beztack/state/adapters/react';
 *
 * createRoot(document.getElementById('root')!).render(
 *   <NuqsAdapter>
 *     <App />
 *   </NuqsAdapter>
 * );
 * 
 * ```
 */

export { NuqsAdapter } from "nuqs/adapters/react";
