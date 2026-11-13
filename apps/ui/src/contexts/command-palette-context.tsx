import { createContext, useContext } from "react";

export type CommandPaletteControls = {
  open: () => void;
};

export const CommandPaletteContext = createContext<CommandPaletteControls | null>(null);

/** The palette controls, or `null` outside the app shell (nothing to open). */
export function useOptionalCommandPalette(): CommandPaletteControls | null {
  return useContext(CommandPaletteContext);
}
