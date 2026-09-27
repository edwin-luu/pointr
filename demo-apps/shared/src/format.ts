const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function money(n: number): string {
  return currency.format(n);
}

export function formatDate(d: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(
    "en-US",
    opts ?? { month: "short", day: "numeric", year: "numeric" },
  );
}

export function randomConfirmationNumber(prefix: string, digits: number): string {
  let n = "";
  for (let i = 0; i < digits; i++) n += Math.floor(Math.random() * 10).toString();
  return `${prefix}${n}`;
}
