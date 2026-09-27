import { createContext, useContext, type ReactNode } from "react";
import { usePharmacyState } from "./usePharmacyState.ts";

type Ctx = ReturnType<typeof usePharmacyState>;

const PharmacyCtx = createContext<Ctx | null>(null);

export function PharmacyStateProvider({ children }: { children: ReactNode }) {
  const value = usePharmacyState();
  return <PharmacyCtx.Provider value={value}>{children}</PharmacyCtx.Provider>;
}

export function usePharmacyStateCtx(): Ctx {
  const ctx = useContext(PharmacyCtx);
  if (!ctx) throw new Error("usePharmacyStateCtx must be used within PharmacyStateProvider");
  return ctx;
}
