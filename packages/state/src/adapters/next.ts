/**
 * Next.js Unified Adapter (router-agnostic)
 *
 * Use this if your Next.js app uses both App and Pages routers.
 * For specific routers, use next/app or next/pages instead.
 *
 * @example
 * ```tsx
 * import { NuqsAdapter } from '@beztack/state/adapters/next';
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <html>
 *       <body>
 *         <NuqsAdapter>{children}</NuqsAdapter>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */

export { NuqsAdapter } from "nuqs/adapters/next";
