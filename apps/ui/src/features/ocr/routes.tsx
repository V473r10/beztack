import type { RouteObject } from "react-router";
import OCR from "../../app/ocr/ocr.tsx";

/**
 * OCR Routes
 *
 * OCR feature routes for optical character recognition.
 */
export const OcrRoutes: RouteObject[] = [
  {
    path: "ocr",
    element: <OCR />,
  },
];
