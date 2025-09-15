import { createContext, useContext, useEffect, useState } from "react";
import { extractFonts, loadThemeCSS } from "@/lib/css-parser";

// Regular expressions used for CSS parsing
const ROOT_CSS_REGEX = /:root\s*\{([^}]+)\}/;
const CSS_VARIABLE_REGEX = /--([^:]+):\s*([^;]+);/g;

type Theme = "dark" | "light" | "system";
export type ColorTheme = string;

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultColorTheme?: ColorTheme;
  storageKey?: string;
  colorStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  colorTheme: ColorTheme;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  colorTheme: "default",
  setTheme: () => null,
  setColorTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

// Helper functions to reduce cognitive complexity
function createThemeLink(colorTheme: ColorTheme): HTMLLinkElement {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `/src/styles/themes/${colorTheme}.css`;
  link.id = `theme-${colorTheme}`;
  return link;
}

function parseVariablesFromCSS(cssContent: string): Record<string, string> {
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

function createFontLink(
  colorTheme: ColorTheme,
  googleFontsUrl: string
): HTMLLinkElement {
  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = googleFontsUrl;
  fontLink.id = `theme-fonts-${colorTheme}`;
  return fontLink;
}

function removeExistingElement(id: string): void {
  const existingElement = document.getElementById(id);
  if (existingElement) {
    document.head.removeChild(existingElement);
  }
}

async function loadCustomFonts(colorTheme: ColorTheme): Promise<void> {
  const response = await fetch(`/src/styles/themes/${colorTheme}.css`);
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

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultColorTheme = "default",
  storageKey = "ui-theme",
  colorStorageKey = "ui-color-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );
  const [colorTheme, setColorTheme] = useState<ColorTheme>(
    () =>
      (localStorage.getItem(colorStorageKey) as ColorTheme) || defaultColorTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    // Remove existing theme classes
    const existingThemeClasses = Array.from(root.classList).filter((cls) =>
      cls.startsWith("theme-")
    );
    root.classList.remove("light", "dark", ...existingThemeClasses);

    // Apply color theme class
    root.classList.add(`theme-${colorTheme}`);

    // Apply light/dark mode
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme, colorTheme]);

  // Load color theme CSS and fonts dynamically
  useEffect(() => {
    if (colorTheme === "default") {
      return;
    }

    const loadThemeAssets = async () => {
      // Load CSS
      const themeLink = createThemeLink(colorTheme);
      document.head.appendChild(themeLink);

      // Load custom fonts if needed
      try {
        const parsedTheme = await loadThemeCSS(colorTheme);
        if (parsedTheme?.fonts) {
          await loadCustomFonts(colorTheme);
        }
      } catch {
        // Silently handle theme loading errors to prevent breaking the UI
        // The theme will fall back to default styling
      }
    };

    loadThemeAssets();

    return () => {
      // Clean up CSS and fonts
      removeExistingElement(`theme-${colorTheme}`);
      removeExistingElement(`theme-fonts-${colorTheme}`);
    };
  }, [colorTheme]);

  const value = {
    theme,
    colorTheme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
    },
    setColorTheme: (newColorTheme: ColorTheme) => {
      localStorage.setItem(colorStorageKey, newColorTheme);
      setColorTheme(newColorTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
