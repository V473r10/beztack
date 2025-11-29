import type { RouteObject } from "react-router";
import { AI } from "../../app/ai/ai.tsx";

/**
 * AI Routes
 *
 * AI feature routes for text generation and AI interactions.
 */
export const AiRoutes: RouteObject[] = [
  {
    path: "ai",
    element: <AI />,
  },
];
