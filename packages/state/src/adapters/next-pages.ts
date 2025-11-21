/**
 * Next.js Pages Router Adapter
 *
 * Wrap the Component outlet with NuqsAdapter in your _app.tsx:
 *
 * @example
 * ```tsx
 * import { NuqsAdapter } from '@beztack/state/adapters/next/pages';
 *
 * export default function MyApp({ Component, pageProps }) {
 *   return (
 *     <NuqsAdapter>
 *       <Component {...pageProps} />
 *     </NuqsAdapter>
 *   );
 * }
 * ```
 */

export { NuqsAdapter } from "nuqs/adapters/next/pages";
