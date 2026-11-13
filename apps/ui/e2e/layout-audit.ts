import type { Page } from "@playwright/test";

export type LayoutViolation = {
  rule: "horizontal-scroll" | "past-viewport" | "wrapped-button" | "raw-i18n-key";
  detail: string;
};

const SUBPIXEL_TOLERANCE_PX = 1;
const MAX_LABEL_LENGTH = 60;

/**
 * Audit the page as it is right now. Runs inside the browser and returns the
 * violations; an empty list means the page passes.
 *
 * Rules (BZ-117):
 * - horizontal-scroll: the page itself scrolls sideways.
 * - past-viewport: a visible interactive element sticks out of the viewport and no
 *   scrollable container of its own lets the visitor reach it.
 * - wrapped-button: a button label breaks onto a second line (accordion triggers excepted).
 * - raw-i18n-key: visible text (or a label attribute) is an untranslated key such as
 *   `billing.page.title`. `keyNamespaces` are the top-level groups of `en.json`.
 */
export function auditLayout(
  page: Page,
  keyNamespaces: readonly string[],
): Promise<LayoutViolation[]> {
  return page.evaluate(
    ({ namespaces, tolerance, maxLabel }) => {
      const violations: LayoutViolation[] = [];
      const viewportWidth = document.documentElement.clientWidth;

      const labelOf = (element: Element): string => {
        const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
        const aria = element.getAttribute("aria-label") ?? "";
        const label = (text || aria || element.getAttribute("href") || "").slice(0, maxLabel);
        return `<${element.tagName.toLowerCase()}> "${label}"`;
      };

      const isVisible = (element: Element): boolean => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      };

      // 1. The page scrolls sideways.
      const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      if (scrollWidth > viewportWidth + tolerance) {
        violations.push({
          rule: "horizontal-scroll",
          detail: `page is ${scrollWidth}px wide in a ${viewportWidth}px viewport`,
        });
      }

      // 2. Interactive elements past the viewport edge.
      const interactiveSelector = [
        "a[href]",
        "button",
        "input:not([type=hidden])",
        "select",
        "textarea",
        "[role=button]",
        "[role=tab]",
        "[role=menuitem]",
        "[role=combobox]",
        "[role=switch]",
        "[role=checkbox]",
      ].join(",");

      const scrollsSideways = (element: Element): boolean => {
        let parent = element.parentElement;
        while (parent && parent !== document.body) {
          const { overflowX } = getComputedStyle(parent);
          if (
            (overflowX === "auto" || overflowX === "scroll") &&
            parent.scrollWidth > parent.clientWidth + tolerance
          ) {
            return true;
          }
          parent = parent.parentElement;
        }
        return false;
      };

      for (const element of document.querySelectorAll(interactiveSelector)) {
        if (!isVisible(element) || element.closest("[inert], [aria-hidden=true]")) {
          continue;
        }
        const rect = element.getBoundingClientRect();
        const sticksOut = rect.right > viewportWidth + tolerance || rect.left < -tolerance;
        if (sticksOut && !scrollsSideways(element)) {
          violations.push({
            rule: "past-viewport",
            detail: `${labelOf(element)} spans ${Math.round(rect.left)}..${Math.round(rect.right)}px of ${viewportWidth}px`,
          });
        }
      }

      // 3. Buttons whose label wraps onto two lines.
      // Accordion triggers are whole questions or headings and are meant to wrap.
      const buttonSelector = "button, [role=button], [data-slot=button]";
      for (const element of document.querySelectorAll(buttonSelector)) {
        if (!isVisible(element) || element.matches("[data-slot=accordion-trigger]")) {
          continue;
        }
        const textRects: { top: number; height: number }[] = [];
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.textContent?.trim()) {
            continue;
          }
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const rect of range.getClientRects()) {
            if (rect.width > 0 && rect.height > 0) {
              textRects.push({ top: rect.top, height: rect.height });
            }
          }
        }
        // Two text rects are on different lines when one starts below half the other's height.
        textRects.sort((a, b) => a.top - b.top);
        let lines = 0;
        let previous: { top: number; height: number } | undefined;
        for (const rect of textRects) {
          if (!previous || rect.top - previous.top > previous.height / 2) {
            lines += 1;
            previous = rect;
          }
        }
        if (lines > 1) {
          violations.push({
            rule: "wrapped-button",
            detail: `${labelOf(element)} wraps onto ${lines} lines`,
          });
        }
      }

      // 4. Untranslated i18n keys, in visible text and in label attributes.
      const keyPattern = new RegExp(
        `(?<![\\w@./-])(?:${namespaces.join("|")})(?:\\.[A-Za-z0-9_-]+)+(?![\\w@-])`,
        "g",
      );
      const seenKeys = new Set<string>();
      const collect = (text: string, where: string) => {
        for (const match of text.matchAll(keyPattern)) {
          if (!seenKeys.has(match[0])) {
            seenKeys.add(match[0]);
            violations.push({ rule: "raw-i18n-key", detail: `"${match[0]}" in ${where}` });
          }
        }
      };
      collect(document.body.innerText, "visible text");
      for (const element of document.querySelectorAll("[aria-label], [placeholder], [title]")) {
        if (!isVisible(element)) {
          continue;
        }
        for (const attribute of ["aria-label", "placeholder", "title"]) {
          collect(element.getAttribute(attribute) ?? "", `${attribute} of ${labelOf(element)}`);
        }
      }

      return violations;
    },
    {
      namespaces: [...keyNamespaces],
      tolerance: SUBPIXEL_TOLERANCE_PX,
      maxLabel: MAX_LABEL_LENGTH,
    },
  );
}

export function describeViolations(violations: readonly LayoutViolation[]): string {
  return violations.map((violation) => `  [${violation.rule}] ${violation.detail}`).join("\n");
}
