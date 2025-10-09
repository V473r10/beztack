export type ParsedThemeColors = {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
};

export type ParsedThemeFonts = {
  sans?: string;
  serif?: string;
  mono?: string;
};

export type ParsedTheme = {
  colors: ParsedThemeColors;
  fonts: ParsedThemeFonts;
  radius?: string;
};

// Regular expressions for CSS parsing
const ROOT_CSS_REGEX = /:root\s*\{([^}]+)\}/;
const CSS_VARIABLE_REGEX = /--([^:]+):\s*([^;]+);/g;

// Extract CSS variables from theme CSS content
export function parseCSSVariables(cssContent: string): Record<string, string> {
  const variables: Record<string, string> = {};

  // Match CSS variables in :root selector
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

// Common Google Fonts that we should auto-import
const KNOWN_GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Source Sans Pro",
  "Raleway",
  "Poppins",
  "Nunito",
  "Ubuntu",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "PT Serif",
  "Crimson Text",
  "Source Code Pro",
  "Fira Code",
  "JetBrains Mono",
  "Monaco",
  "Consolas",
  "Oxanium",
  "Space Grotesk",
  "DM Sans",
  "Work Sans",
  "Manrope",
  "Plus Jakarta Sans",
];

// Helper function to extract Google Fonts from a font family string
function addGoogleFontsFromFamily(
  fontFamily: string,
  googleFonts: string[]
): void {
  for (const font of KNOWN_GOOGLE_FONTS) {
    if (fontFamily.includes(font) && !googleFonts.includes(font)) {
      googleFonts.push(font);
    }
  }
}

// Helper function to generate Google Fonts URL
function generateGoogleFontsUrl(googleFonts: string[]): string {
  const fontParams = googleFonts
    .map((font) => {
      // Default weights for better display - use semicolons for Google Fonts API
      const weights = "300;400;500;600;700";
      return `family=${encodeURIComponent(font)}:wght@${weights}`;
    })
    .join("&");

  return `https://fonts.googleapis.com/css2?${fontParams}&display=swap`;
}

// Extract font families and create Google Fonts imports
export function extractFonts(variables: Record<string, string>): {
  fonts: ParsedThemeFonts;
  googleFontsUrl?: string;
} {
  const fonts: ParsedThemeFonts = {};
  const googleFonts: string[] = [];

  // Extract font families
  if (variables["font-sans"]) {
    fonts.sans = variables["font-sans"];
    addGoogleFontsFromFamily(variables["font-sans"], googleFonts);
  }

  if (variables["font-serif"]) {
    fonts.serif = variables["font-serif"];
    addGoogleFontsFromFamily(variables["font-serif"], googleFonts);
  }

  if (variables["font-mono"]) {
    fonts.mono = variables["font-mono"];
    addGoogleFontsFromFamily(variables["font-mono"], googleFonts);
  }

  // Generate Google Fonts URL if needed
  if (googleFonts.length > 0) {
    const googleFontsUrl = generateGoogleFontsUrl(googleFonts);
    return { fonts, googleFontsUrl };
  }

  return { fonts };
}

// Extract theme colors from CSS variables
export function extractThemeColors(
  variables: Record<string, string>
): ParsedThemeColors {
  return {
    background: variables.background || "hsl(0 0% 100%)",
    foreground: variables.foreground || "hsl(222.2 84% 4.9%)",
    primary: variables.primary || "hsl(222.2 47.4% 11.2%)",
    secondary: variables.secondary || "hsl(210 40% 96%)",
    accent: variables.accent || "hsl(210 40% 94%)",
  };
}

// Parse complete theme from CSS content
export function parseThemeCSS(cssContent: string): ParsedTheme {
  const variables = parseCSSVariables(cssContent);
  const colors = extractThemeColors(variables);
  const { fonts } = extractFonts(variables);

  return {
    colors,
    fonts,
    radius: variables.radius,
  };
}

// Load and parse theme CSS file
export async function loadThemeCSS(
  themeName: string
): Promise<ParsedTheme | null> {
  if (themeName === "default") {
    return {
      colors: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222.2 84% 4.9%)",
        primary: "hsl(222.2 47.4% 11.2%)",
        secondary: "hsl(210 40% 96%)",
        accent: "hsl(210 40% 94%)",
      },
      fonts: {},
    };
  }

  // Fetch theme CSS from public folder
  // Vite serves files from public/ at the root URL
  const response = await fetch(`/themes/${themeName}.css`);
  if (!response.ok) {
    return null;
  }

  const cssContent = await response.text();
  return parseThemeCSS(cssContent);
}
