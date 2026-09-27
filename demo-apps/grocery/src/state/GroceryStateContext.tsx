import { createContext, useContext, type ReactNode } from "react";
import { useGroceryState } from "./useGroceryState.ts";

type Ctx = ReturnType<typeof useGroceryState>;

const GroceryCtx = createContext<Ctx | null>(null);

export function GroceryStateProvider({ children }: { children: ReactNode }) {
  const value = useGroceryState();
  return <GroceryCtx.Provider value={value}>{children}</GroceryCtx.Provider>;
}

export function useGroceryStateCtx(): Ctx {
  const ctx = useContext(GroceryCtx);
  if (!ctx) throw new Error("useGroceryStateCtx must be used within GroceryStateProvider");
  return ctx;
}
