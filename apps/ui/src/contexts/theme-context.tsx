import { createContext, useContext, useEffect, useState } from "react";
import { extractFonts, loadThemeCSS } from "@/lib/css-parser";

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
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `/src/styles/themes/${colorTheme}.css`;
      link.id = `theme-${colorTheme}`;
      document.head.appendChild(link);

      // Load custom fonts if needed
      try {
        const parsedTheme = await loadThemeCSS(colorTheme);
        if (parsedTheme?.fonts) {
          // Parse CSS to get font info with Google Fonts URL
          const response = await fetch(`/src/styles/themes/${colorTheme}.css`);
          if (response.ok) {
            const cssContent = await response.text();
            const variables: Record<string, string> = {};
            const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
            if (rootMatch) {
              const rootContent = rootMatch[1];
              const variableRegex = /--([^:]+):\s*([^;]+);/g;
              let match: RegExpExecArray | null =
                variableRegex.exec(rootContent);
              while (match !== null) {
                const varName = match[1].trim();
                const varValue = match[2].trim();
                variables[varName] = varValue;
                match = variableRegex.exec(rootContent);
              }
            }

            const { googleFontsUrl } = extractFonts(variables);

            if (googleFontsUrl) {
              // Remove existing Google Fonts link for this theme
              const existingFontLink = document.getElementById(
                `theme-fonts-${colorTheme}`
              );
              if (existingFontLink) {
                document.head.removeChild(existingFontLink);
              }

              // Add new Google Fonts link
              const fontLink = document.createElement("link");
              fontLink.rel = "stylesheet";
              fontLink.href = googleFontsUrl;
              fontLink.id = `theme-fonts-${colorTheme}`;
              document.head.appendChild(fontLink);
            }
          }
        }
      } catch (_error) {}
    };

    loadThemeAssets();

    return () => {
      // Clean up CSS
      const existingLink = document.getElementById(`theme-${colorTheme}`);
      if (existingLink) {
        document.head.removeChild(existingLink);
      }

      // Clean up fonts
      const existingFontLink = document.getElementById(
        `theme-fonts-${colorTheme}`
      );
      if (existingFontLink) {
        document.head.removeChild(existingFontLink);
      }
    };
  }, [colorTheme]);

  const value = {
    theme,
    colorTheme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
    setColorTheme: (colorTheme: ColorTheme) => {
      localStorage.setItem(colorStorageKey, colorTheme);
      setColorTheme(colorTheme);
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
