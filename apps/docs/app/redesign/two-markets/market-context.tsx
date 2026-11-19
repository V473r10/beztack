"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type Market = "latam" | "world";

type MarketState = {
  market: Market;
  setMarket: (market: Market) => void;
  /** True once someone has used a switch, so nothing animates just because the page loaded. */
  switched: boolean;
};

const MarketContext = createContext<MarketState | null>(null);

/** Holds the market chosen in the hero switch, so other sections can follow it. */
export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ market: Market; switched: boolean }>({
    market: "latam",
    switched: false,
  });
  const value = useMemo(
    () => ({
      market: state.market,
      switched: state.switched,
      setMarket: (market: Market) => setState({ market, switched: true }),
    }),
    [state],
  );
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketState {
  const value = useContext(MarketContext);
  if (!value) {
    throw new Error("useMarket needs a MarketProvider above it.");
  }
  return value;
}
