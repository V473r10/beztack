/**
 * Next.js App Router Adapter
 *
 * Wrap your {children} with NuqsAdapter in your root layout:
 *
 * @example
 * ```tsx
 * import { NuqsAdapter } from '@beztack/state/adapters/next/app';
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

export { NuqsAdapter } from "nuqs/adapters/next/app";
