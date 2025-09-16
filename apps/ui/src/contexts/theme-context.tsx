import { useEffect, useState } from "react";
import { loadThemeCSS } from "@/lib/css-parser";
import type {
  Theme,
  ColorTheme,
  ThemeProviderProps,
} from "./theme-types";
import {
  createThemeLink,
  loadCustomFonts,
  removeExistingElement,
} from "./theme-utils";
import { ThemeProviderContext } from "./theme-provider-context";

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
