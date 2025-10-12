import { extractFonts } from "@/lib/css-parser";
import { ROOT_CSS_REGEX, CSS_VARIABLE_REGEX, type ColorTheme } from "./theme-types";

// Helper functions for theme management
export function createThemeLink(colorTheme: ColorTheme): HTMLLinkElement {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `/themes/${colorTheme}.css`;
  link.id = `theme-${colorTheme}`;
  return link;
}

export function parseVariablesFromCSS(cssContent: string): Record<string, string> {
  const variables: Record<string, string> = {};
  const rootMatch = cssContent.match(ROOT_CSS_REGEX);

  if (rootMatch) {
    const rootContent = rootMatch[1];
    let match: RegExpExecArray | null = CSS_VARIABLE_REGEX.exec(rootContent);

    while (match !== null) {
      const varName = match[1].trim();
      const varValue = match[2].trim();
      variables[varName] = varValue;
      match = CSS_VARIABLE_REGEX.exec(rootContent);
    }
  }

  return variables;
}

export function createFontLink(
  colorTheme: ColorTheme,
  googleFontsUrl: string
): HTMLLinkElement {
  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = googleFontsUrl;
  fontLink.id = `theme-fonts-${colorTheme}`;
  return fontLink;
}

export function removeExistingElement(id: string): void {
  const existingElement = document.getElementById(id);
  if (existingElement) {
    document.head.removeChild(existingElement);
  }
}

export async function loadCustomFonts(colorTheme: ColorTheme): Promise<void> {
  const response = await fetch(`/themes/${colorTheme}.css`);
  if (!response.ok) {
    return;
  }

  const cssContent = await response.text();
  const variables = parseVariablesFromCSS(cssContent);
  const { googleFontsUrl } = extractFonts(variables);

  if (googleFontsUrl) {
    removeExistingElement(`theme-fonts-${colorTheme}`);
    const fontLink = createFontLink(colorTheme, googleFontsUrl);
    document.head.appendChild(fontLink);
  }
}
