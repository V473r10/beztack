// AUTO-GENERATED – DO NOT EDIT

import { AiRoutes } from "./features/ai/routes.js";
import { AuthRoutes } from "./features/auth/routes.js";
import { OcrRoutes } from "./features/ocr/routes.js";
import { PaymentsRoutes } from "./features/payments/routes.js";
import { StateRoutes } from "./features/state/routes.js";

export const routes = [
  ...AuthRoutes,
  ...PaymentsRoutes,
  ...AiRoutes,
  ...OcrRoutes,
  ...StateRoutes,
];
