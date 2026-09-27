export type AppName = "bank" | "pharmacy" | "grocery";

const DEFAULTS: Record<AppName, number> = {
  bank: 0.33,
  pharmacy: 0.4,
  grocery: 0.2,
};

export async function getPopupChance(app: AppName): Promise<number> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 800);
    const res = await fetch("http://localhost:3000/api/settings", {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("bad response");
    const data = (await res.json()) as { popups?: Partial<Record<AppName, number>> };
    const v = data.popups?.[app];
    return typeof v === "number" ? v : DEFAULTS[app];
  } catch {
    return DEFAULTS[app];
  }
}

export async function rollPopup(app: AppName): Promise<boolean> {
  const chance = await getPopupChance(app);
  return Math.random() < chance;
}
