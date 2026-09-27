export type AccountKey = "checking" | "savings" | "card";

export type Category =
  | "Groceries"
  | "Dining"
  | "Gas"
  | "Utilities"
  | "Shopping"
  | "Health"
  | "Entertainment"
  | "Transportation"
  | "Payment"
  | "Transfer"
  | "Deposit";

export type Transaction = {
  id: string;
  account: AccountKey;
  date: string;
  description: string;
  category: Category;
  amount: number;
  balanceAfter: number;
};

export type Message = {
  id: string;
  topic: string;
  subject: string;
  body: string;
  date: string;
  reply?: string;
};

export type BankState = {
  checking: number;
  savings: number;
  cardCurrent: number;
  cardStatement: number;
  cardMinDue: number;
  cardLimit: number;
  paperless: boolean;
  transactions: Transaction[];
  messages: Message[];
};
