export interface ParsedThemeColors {
	background: string;
	foreground: string;
	primary: string;
	secondary: string;
	accent: string;
}

export interface ParsedThemeFonts {
	sans?: string;
	serif?: string;
	mono?: string;
}

export interface ParsedTheme {
	colors: ParsedThemeColors;
	fonts: ParsedThemeFonts;
	radius?: string;
}

// Extract CSS variables from theme CSS content
export function parseCSSVariables(cssContent: string): Record<string, string> {
	const variables: Record<string, string> = {};
	
	// Match CSS variables in :root selector
	const rootMatch = cssContent.match(/:root\s*\{([^}]+)\}/);
	if (rootMatch) {
		const rootContent = rootMatch[1];
		const variableRegex = /--([^:]+):\s*([^;]+);/g;
		
		let match: RegExpExecArray | null = variableRegex.exec(rootContent);
		while (match !== null) {
			const varName = match[1].trim();
			const varValue = match[2].trim();
			variables[varName] = varValue;
			match = variableRegex.exec(rootContent);
		}
	}
	
	return variables;
}

// Extract font families and create Google Fonts imports
export function extractFonts(variables: Record<string, string>): {
	fonts: ParsedThemeFonts;
	googleFontsUrl?: string;
} {
	const fonts: ParsedThemeFonts = {};
	const googleFonts: string[] = [];
	
	// Common Google Fonts that we should auto-import
	const knownGoogleFonts = [
		'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro',
		'Raleway', 'Poppins', 'Nunito', 'Ubuntu', 'Playfair Display', 'Merriweather',
		'Lora', 'PT Serif', 'Crimson Text', 'Source Code Pro', 'Fira Code',
		'JetBrains Mono', 'Monaco', 'Consolas', 'Oxanium', 'Space Grotesk',
		'DM Sans', 'Work Sans', 'Manrope', 'Plus Jakarta Sans'
	];
	
	// Extract font families
	if (variables['font-sans']) {
		fonts.sans = variables['font-sans'];
		// Check if it contains a Google Font
		for (const font of knownGoogleFonts) {
			if (variables['font-sans'].includes(font) && !googleFonts.includes(font)) {
				googleFonts.push(font);
			}
		}
	}
	
	if (variables['font-serif']) {
		fonts.serif = variables['font-serif'];
		for (const font of knownGoogleFonts) {
			if (variables['font-serif'].includes(font) && !googleFonts.includes(font)) {
				googleFonts.push(font);
			}
		}
	}
	
	if (variables['font-mono']) {
		fonts.mono = variables['font-mono'];
		for (const font of knownGoogleFonts) {
			if (variables['font-mono'].includes(font) && !googleFonts.includes(font)) {
				googleFonts.push(font);
			}
		}
	}
	
	// Generate Google Fonts URL if needed
	if (googleFonts.length > 0) {
		const fontParams = googleFonts.map(font => {
			// Default weights for better display - use semicolons for Google Fonts API
			const weights = '300;400;500;600;700';
			return `family=${encodeURIComponent(font)}:wght@${weights}`;
		}).join('&');
		
		const googleFontsUrl = `https://fonts.googleapis.com/css2?${fontParams}&display=swap`;
		return { fonts, googleFontsUrl };
	}
	
	return { fonts };
}

// Extract theme colors from CSS variables
export function extractThemeColors(variables: Record<string, string>): ParsedThemeColors {
	return {
		background: variables.background || 'hsl(0 0% 100%)',
		foreground: variables.foreground || 'hsl(222.2 84% 4.9%)',
		primary: variables.primary || 'hsl(222.2 47.4% 11.2%)',
		secondary: variables.secondary || 'hsl(210 40% 96%)',
		accent: variables.accent || 'hsl(210 40% 94%)'
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
		radius: variables.radius
	};
}

// Load and parse theme CSS file
export async function loadThemeCSS(themeName: string): Promise<ParsedTheme | null> {
	if (themeName === 'default') {
		return {
			colors: {
				background: 'hsl(0 0% 100%)',
				foreground: 'hsl(222.2 84% 4.9%)',
				primary: 'hsl(222.2 47.4% 11.2%)',
				secondary: 'hsl(210 40% 96%)',
				accent: 'hsl(210 40% 94%)'
			},
			fonts: {},
		};
	}
	
	try {
		// In a Vite environment, we can't directly read files from the public folder
		// Instead, we'll make a fetch request to the theme CSS file
		const response = await fetch(`/src/styles/themes/${themeName}.css`);
		if (!response.ok) {
			console.warn(`Failed to load theme CSS for ${themeName}`);
			return null;
		}
		
		const cssContent = await response.text();
		return parseThemeCSS(cssContent);
	} catch (error) {
		console.error(`Error loading theme CSS for ${themeName}:`, error);
		return null;
	}
}
