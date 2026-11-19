"use client";

import { createContext, useContext, useMemo, useState } from "react";

export type Market = "latam" | "world";

type MarketState = {
  market: Market;
  setMarket: (market: Market) => void;
};

const MarketContext = createContext<MarketState | null>(null);

/** Holds the market chosen in the hero switch, so other sections can follow it. */
export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [market, setMarket] = useState<Market>("latam");
  const value = useMemo(() => ({ market, setMarket }), [market]);
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

export function useMarket(): MarketState {
  const value = useContext(MarketContext);
  if (!value) {
    throw new Error("useMarket needs a MarketProvider above it.");
  }
  return value;
}
