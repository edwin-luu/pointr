import { useEffect, useState } from "react";
import { getItem, setItem } from "@demo/shared";
import { buildInitialBankState } from "../data/seed.ts";
import type { AccountKey, BankState, Category, Transaction } from "../data/types.ts";

const PREFIX = "harbor:";
const KEY = "state";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function useBankState() {
  const [state, setState] = useState<BankState>(() => getItem<BankState | null>(PREFIX, KEY, null) ?? buildInitialBankState());

  useEffect(() => {
    setItem(PREFIX, KEY, state);
  }, [state]);

  function applyTx(account: AccountKey, description: string, category: Category, amount: number) {
    setState((prev) => {
      const balanceKey = account === "checking" ? "checking" : account === "savings" ? "savings" : "cardCurrent";
      const newBalance = round2((prev[balanceKey] as number) + amount);
      const tx: Transaction = {
        id: makeId(account),
        account,
        date: today(),
        description,
        category,
        amount,
        balanceAfter: newBalance,
      };
      return { ...prev, [balanceKey]: newBalance, transactions: [tx, ...prev.transactions] };
    });
  }

  function payCard(amount: number, fromAccount: "checking" | "savings") {
    applyTx(fromAccount, "Payment to Harbor Rewards Visa ••1956", "Payment", -amount);
    applyTx("card", "Payment received - thank you", "Payment", -amount);
    setState((prev) => ({
      ...prev,
      cardStatement: amount >= prev.cardStatement ? 0 : prev.cardStatement,
    }));
  }

  function payBill(payeeName: string, amount: number, fromAccount: "checking" | "savings") {
    applyTx(fromAccount, `Payment to ${payeeName}`, "Utilities", -amount);
  }

  function transfer(amount: number, fromAccount: "checking" | "savings", toAccount: "checking" | "savings") {
    applyTx(fromAccount, `Transfer to ${toAccount === "checking" ? "Everyday Checking" : "Harbor Savings"}`, "Transfer", -amount);
    applyTx(toAccount, `Transfer from ${fromAccount === "checking" ? "Everyday Checking" : "Harbor Savings"}`, "Transfer", amount);
  }

  function setPaperless(paperless: boolean) {
    setState((prev) => ({ ...prev, paperless }));
  }

  function sendMessage(topic: string, subject: string, body: string) {
    setState((prev) => ({
      ...prev,
      messages: [
        { id: makeId("msg"), topic, subject, body, date: today() },
        ...prev.messages,
      ],
    }));
  }

  return { state, payCard, payBill, transfer, setPaperless, sendMessage };
}
