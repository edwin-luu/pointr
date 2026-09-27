import { useEffect, useState } from "react";
import { getItem, setItem } from "@demo/shared";
import { productById } from "../data/catalog.ts";
import type { CartLine, GroceryState, Order } from "../data/types.ts";

const PREFIX = "freshcart:";
const KEY = "state";

function initial(): GroceryState {
  return { cart: [], orders: [], storeId: "aisle8" };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function randomOrderNumber(): string {
  let n = "";
  for (let i = 0; i < 6; i++) n += Math.floor(Math.random() * 10).toString();
  return `FC-${n}`;
}

export function useGroceryState() {
  const [state, setState] = useState<GroceryState>(() => getItem<GroceryState | null>(PREFIX, KEY, null) ?? initial());

  useEffect(() => {
    setItem(PREFIX, KEY, state);
  }, [state]);

  function addToCart(productId: string, qty = 1) {
    setState((prev) => {
      const existing = prev.cart.find((l) => l.productId === productId);
      const cart: CartLine[] = existing
        ? prev.cart.map((l) => (l.productId === productId ? { ...l, qty: l.qty + qty } : l))
        : [...prev.cart, { productId, qty }];
      return { ...prev, cart };
    });
  }

  function setQty(productId: string, qty: number) {
    setState((prev) => ({
      ...prev,
      cart: qty <= 0 ? prev.cart.filter((l) => l.productId !== productId) : prev.cart.map((l) => (l.productId === productId ? { ...l, qty } : l)),
    }));
  }

  function removeFromCart(productId: string) {
    setState((prev) => ({ ...prev, cart: prev.cart.filter((l) => l.productId !== productId) }));
  }

  function setStore(storeId: string) {
    setState((prev) => ({ ...prev, storeId }));
  }

  function cartSubtotal(): number {
    return round2(
      state.cart.reduce((sum, l) => {
        const product = productById(l.productId);
        return sum + (product ? product.price * l.qty : 0);
      }, 0),
    );
  }

  function placeOrder(opts: { fulfillment: "Pickup" | "Delivery"; window: string; storeName: string }): Order {
    const lines = state.cart
      .map((l) => {
        const product = productById(l.productId);
        return product ? { name: product.name, size: product.size, qty: l.qty, price: product.price } : null;
      })
      .filter((l): l is Order["lines"][number] => l !== null);
    const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
    const deliveryFee = opts.fulfillment === "Delivery" ? 3.99 : 0;
    const serviceFee = opts.fulfillment === "Delivery" ? 2.49 : 0;
    const tax = round2(subtotal * 0.07);
    const total = round2(subtotal + deliveryFee + serviceFee + tax);
    const order: Order = {
      id: randomOrderNumber(),
      lines,
      fulfillment: opts.fulfillment,
      window: opts.window,
      store: opts.storeName,
      total,
      date: new Date().toISOString().slice(0, 10),
    };
    setState((prev) => ({ ...prev, cart: [], orders: [order, ...prev.orders] }));
    return order;
  }

  return { state, addToCart, setQty, removeFromCart, setStore, cartSubtotal, placeOrder };
}
