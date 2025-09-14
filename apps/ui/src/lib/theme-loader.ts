import { loadThemeCSS } from "./css-parser";

export type ThemeInfo = {
  name: string;
  label: string;
  description: string;
  preview: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    accent: string;
  };
  fonts?: {
    sans?: string;
    serif?: string;
    mono?: string;
  };
  googleFontsUrl?: string;
  radius?: string;
};

// Theme metadata extracted from CSS files
const themeMetadata: Record<string, Omit<ThemeInfo, "name" | "preview">> = {
  default: {
    label: "Default",
    description: "Clean and modern design",
  },
  "doom-64": {
    label: "Doom 64",
    description: "Retro gaming inspired theme",
  },
  bubblegum: {
    label: "Bubblegum",
    description: "Colorful and playful design",
  },
  "amber-minimal": {
    label: "Amber Minimal",
    description: "Warm amber tones with minimal design",
  },
  "amethyst-haze": {
    label: "Amethyst Haze",
    description: "Purple mystical theme",
  },
  "bold-tech": {
    label: "Bold Tech",
    description: "High-tech corporate style",
  },
  caffeine: {
    label: "Caffeine",
    description: "Energetic coffee-inspired colors",
  },
  candyland: {
    label: "Candyland",
    description: "Sweet and playful candy colors",
  },
  catppuccin: {
    label: "Catppuccin",
    description: "Soothing pastel theme",
  },
  claude: {
    label: "Claude",
    description: "AI-inspired clean design",
  },
  claymorphism: {
    label: "Claymorphism",
    description: "Soft 3D clay-like design",
  },
  "clean-state": {
    label: "Clean State",
    description: "Pristine minimalist design",
  },
  "cosmic-night": {
    label: "Cosmic Night",
    description: "Deep space inspired theme",
  },
  cyberpunk: {
    label: "Cyberpunk",
    description: "Futuristic neon aesthetic",
  },
  "elegant-luxury": {
    label: "Elegant Luxury",
    description: "Sophisticated luxury design",
  },
  graphite: {
    label: "Graphite",
    description: "Dark professional theme",
  },
  "kodama-groove": {
    label: "Kodama Groove",
    description: "Nature-inspired harmony",
  },
  "midnight-bloom": {
    label: "Midnight Bloom",
    description: "Dark floral elegance",
  },
  "mocha-mousse": {
    label: "Mocha Mousse",
    description: "Rich coffee cream tones",
  },
  "modern-minimal": {
    label: "Modern Minimal",
    description: "Contemporary minimalism",
  },
  mono: {
    label: "Mono",
    description: "Pure monochromatic design",
  },
  nature: {
    label: "Nature",
    description: "Earthy organic colors",
  },
  "neo-brutalism": {
    label: "Neo Brutalism",
    description: "Bold architectural design",
  },
  "northern-lights": {
    label: "Northern Lights",
    description: "Aurora-inspired colors",
  },
  notebook: {
    label: "Notebook",
    description: "Classic paper notebook feel",
  },
  "ocean-breeze": {
    label: "Ocean Breeze",
    description: "Refreshing coastal vibes",
  },
  "pastel-dreams": {
    label: "Pastel Dreams",
    description: "Soft dreamy pastels",
  },
  perpetuity: {
    label: "Perpetuity",
    description: "Timeless elegant design",
  },
  "quantum-rose": {
    label: "Quantum Rose",
    description: "Scientific beauty fusion",
  },
  "retro-arcade": {
    label: "Retro Arcade",
    description: "Classic gaming nostalgia",
  },
  "soft-pop": {
    label: "Soft Pop",
    description: "Gentle pop art colors",
  },
  "solar-dusk": {
    label: "Solar Dusk",
    description: "Sunset-inspired warmth",
  },
  "starry-night": {
    label: "Starry Night",
    description: "Van Gogh inspired theme",
  },
  "sunset-horizon": {
    label: "Sunset Horizon",
    description: "Golden hour beauty",
  },
  supabase: {
    label: "Supabase",
    description: "Database-inspired green",
  },
  "t3-chat": {
    label: "T3 Chat",
    description: "Modern chat interface",
  },
  tangerine: {
    label: "Tangerine",
    description: "Bright citrus energy",
  },
  twitter: {
    label: "Twitter",
    description: "Social media blue theme",
  },
  vercel: {
    label: "Vercel",
    description: "Deployment platform style",
  },
  "vintage-paper": {
    label: "Vintage Paper",
    description: "Aged paper aesthetic",
  },
  "violet-bloom": {
    label: "Violet Bloom",
    description: "Purple floral elegance",
  },
};

// Future: Extract color variables from CSS content for dynamic preview generation
// This would be used in a full implementation that reads CSS files directly
// function extractColorsFromCSS(cssContent: string): ThemeInfo['preview'] { ... }

// Get available theme files dynamically
export function getAvailableThemes(): string[] {
  // In a real implementation, this would use a dynamic import or API call
  // For now, we'll return the known theme names
  const themes = [
    "default",
    "amber-minimal",
    "amethyst-haze",
    "bold-tech",
    "bubblegum",
    "caffeine",
    "candyland",
    "catppuccin",
    "claude",
    "claymorphism",
    "clean-state",
    "cosmic-night",
    "cyberpunk",
    "doom-64",
    "elegant-luxury",
    "graphite",
    "kodama-groove",
    "midnight-bloom",
    "mocha-mousse",
    "modern-minimal",
    "mono",
    "nature",
    "neo-brutalism",
    "northern-lights",
    "notebook",
    "ocean-breeze",
    "pastel-dreams",
    "perpetuity",
    "quantum-rose",
    "retro-arcade",
    "soft-pop",
    "solar-dusk",
    "starry-night",
    "sunset-horizon",
    "supabase",
    "t3-chat",
    "tangerine",
    "twitter",
    "vercel",
    "vintage-paper",
    "violet-bloom",
  ];

  return themes;
}

// Load theme information dynamically
export async function loadThemeInfo(themeName: string): Promise<ThemeInfo> {
  const metadata = themeMetadata[themeName] || {
    label: themeName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
    description: "Custom theme",
  };

  // Load and parse the actual CSS file
  try {
    const parsedTheme = await loadThemeCSS(themeName);

    if (parsedTheme) {
      return {
        name: themeName,
        ...metadata,
        preview: parsedTheme.colors,
        fonts: parsedTheme.fonts,
        radius: parsedTheme.radius,
      };
    }
  } catch (_error) {}

  // Fallback to default preview if parsing fails
  return {
    name: themeName,
    ...metadata,
    preview: {
      background: "hsl(0 0% 100%)",
      foreground: "hsl(222.2 84% 4.9%)",
      primary: "hsl(260 100% 50%)",
      secondary: "hsl(210 40% 96%)",
      accent: "hsl(210 40% 94%)",
    },
  };
}

// Get all theme information
export async function getAllThemes(): Promise<ThemeInfo[]> {
  const themeNames = getAvailableThemes();
  const themes = await Promise.all(
    themeNames.map((name) => loadThemeInfo(name))
  );
  return themes;
}
