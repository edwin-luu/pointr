import { createContext, useContext, type ReactNode } from "react";
import { useBankState } from "./useBankState.ts";

type BankStateCtx = ReturnType<typeof useBankState>;

const Ctx = createContext<BankStateCtx | null>(null);

export function BankStateProvider({ children }: { children: ReactNode }) {
  const value = useBankState();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useBankStateCtx(): BankStateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBankStateCtx must be used within BankStateProvider");
  return ctx;
}
