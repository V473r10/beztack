import type { RouteObject } from "react-router";
import NuqsDemo from "../../app/examples/nuqs-demo.tsx";

/**
 * State Routes
 *
 * State management demo routes using nuqs for URL state.
 */
export const StateRoutes: RouteObject[] = [
  {
    path: "nuqs-demo",
    element: <NuqsDemo />,
  },
];
