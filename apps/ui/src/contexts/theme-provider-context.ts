import { createContext } from "react";
import { type ThemeProviderState, THEME_INITIAL_STATE } from "./theme-types";

export const ThemeProviderContext = createContext<ThemeProviderState>(THEME_INITIAL_STATE);
