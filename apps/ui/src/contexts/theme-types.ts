// Theme types and constants
export type Theme = "dark" | "light" | "system";
export type ColorTheme = string;

export type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  defaultColorTheme?: ColorTheme;
  storageKey?: string;
  colorStorageKey?: string;
};

export type ThemeProviderState = {
  theme: Theme;
  colorTheme: ColorTheme;
  setTheme: (theme: Theme) => void;
  setColorTheme: (colorTheme: ColorTheme) => void;
};

export const THEME_INITIAL_STATE: ThemeProviderState = {
  theme: "system",
  colorTheme: "default",
  setTheme: () => null,
  setColorTheme: () => null,
};

// Regular expressions used for CSS parsing
export const ROOT_CSS_REGEX = /:root\s*\{([^}]+)\}/;
export const CSS_VARIABLE_REGEX = /--([^:]+):\s*([^;]+);/g;
