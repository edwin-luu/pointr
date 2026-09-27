import type { AccountKey, BankState, Category, Transaction } from "./types.ts";

const SEED = 20260926;

function mulberry32(seed: number) {
  let s = seed;
  return function rng(): number {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const CATEGORY_MERCHANTS: Record<Category, string[]> = {
  Groceries: ["Palma Supermarket", "Aisle 8 Market"],
  Dining: ["Cafe Cubano Express", "Mango's Grill", "Sunset Pizza Co", "Taco Fiesta Grill"],
  Gas: ["Metro Gas #214", "Sunrise Fuel Stop"],
  Utilities: ["Sunshine Electric", "Bay Water Utility", "Metro Internet"],
  Shopping: ["Palm Center Mall", "CoastalWear", "HomeGoods Plus", "EverydayMart"],
  Health: ["SunPlaza Pharmacy", "Coral Wellness Clinic"],
  Entertainment: ["Cineplex Miami", "StreamPlus", "Bowl-O-Rama"],
  Transportation: ["Metro Transit Pass", "City Parking Authority"],
  Payment: [],
  Transfer: [],
  Deposit: [],
};

const CATEGORY_ACCOUNT: Record<string, AccountKey> = {
  Groceries: "card",
  Dining: "card",
  Shopping: "card",
  Entertainment: "card",
  Health: "card",
  Gas: "checking",
  Utilities: "checking",
  Transportation: "checking",
};

const CATEGORY_RANGE: Record<string, [number, number]> = {
  Dining: [9, 45],
  Gas: [28, 52],
  Utilities: [38, 120],
  Shopping: [12, 140],
  Health: [8, 60],
  Entertainment: [10, 55],
  Transportation: [25, 60],
};

const FILLER_CATEGORIES: Category[] = [
  "Dining",
  "Gas",
  "Utilities",
  "Shopping",
  "Health",
  "Entertainment",
  "Transportation",
];

type RawTx = {
  date: string;
  description: string;
  category: Category;
  account: AccountKey;
  amount: number;
};

function monthFiller(
  rng: () => number,
  year: number,
  month: number,
  maxDay: number,
  count: number,
): RawTx[] {
  const out: RawTx[] = [];
  for (let i = 0; i < count; i++) {
    const category = pick(rng, FILLER_CATEGORIES);
    const day = 1 + Math.floor(rng() * maxDay);
    const merchant = pick(rng, CATEGORY_MERCHANTS[category]);
    const [lo, hi] = CATEGORY_RANGE[category];
    const amount = round2(lo + rng() * (hi - lo));
    out.push({
      date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      description: merchant,
      category,
      account: CATEGORY_ACCOUNT[category],
      amount: -amount,
    });
  }
  return out;
}

function groceryAnchors(
  year: number,
  month: number,
  days: number[],
  amounts: number[],
): RawTx[] {
  return days.map((day, i) => ({
    date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    description: i % 2 === 0 ? "Palma Supermarket" : "Aisle 8 Market",
    category: "Groceries" as Category,
    account: "card" as AccountKey,
    amount: -amounts[i],
  }));
}

function withRunningBalances(
  txs: RawTx[],
  account: AccountKey,
  currentBalance: number,
): Transaction[] {
  const filtered = txs
    .filter((t) => t.account === account)
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const total = filtered.reduce((sum, t) => sum + t.amount, 0);
  let bal = currentBalance - total;
  return filtered.map((t, i) => {
    bal = round2(bal + t.amount);
    return {
      id: `${account}-${t.date}-${i}`,
      account: t.account,
      date: t.date,
      description: t.description,
      category: t.category,
      amount: t.amount,
      balanceAfter: bal,
    };
  });
}

export function buildSeedTransactions(currentChecking: number, currentCard: number): Transaction[] {
  const rng = mulberry32(SEED);

  const july = [...monthFiller(rng, 2026, 7, 31, 13), ...groceryAnchors(2026, 7, [4, 11, 18, 25], [102.3, 88.75, 115.4, 96.6])];
  const august = [...monthFiller(rng, 2026, 8, 31, 26), ...groceryAnchors(2026, 8, [3, 10, 17, 24], [128.44, 96.1, 110.02, 78.0])];
  const september = [...monthFiller(rng, 2026, 9, 26, 19), ...groceryAnchors(2026, 9, [5, 12, 19], [102.55, 89.59, 95.0])];

  const all = [...july, ...august, ...september];

  const checking = withRunningBalances(all, "checking", currentChecking);
  const card = withRunningBalances(all, "card", currentCard);

  return [...checking, ...card].sort((a, b) => a.date.localeCompare(b.date));
}

export function buildInitialBankState(): BankState {
  const checking = 2431.18;
  const savings = 8905.42;
  const cardCurrent = 642.37;
  const cardStatement = 518.2;
  return {
    checking,
    savings,
    cardCurrent,
    cardStatement,
    cardMinDue: 35.0,
    cardLimit: 5000.0,
    paperless: false,
    transactions: buildSeedTransactions(checking, cardCurrent),
    messages: [],
  };
}
