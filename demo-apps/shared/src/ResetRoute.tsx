import { useEffect } from "react";
import { resetApp } from "./storage.ts";

export function ResetRoute({ prefix }: { prefix: string }) {
  useEffect(() => {
    resetApp(prefix);
  }, [prefix]);
  return null;
}
