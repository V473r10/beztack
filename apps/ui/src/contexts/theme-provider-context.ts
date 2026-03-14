import { createContext } from "react";
import { THEME_INITIAL_STATE, type ThemeProviderState } from "./theme-types";

export const ThemeProviderContext =
  createContext<ThemeProviderState>(THEME_INITIAL_STATE);
