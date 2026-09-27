export type Aisle =
  | "Produce"
  | "Dairy & Eggs"
  | "Bakery"
  | "Meat & Seafood"
  | "Pantry"
  | "Frozen"
  | "Beverages"
  | "Snacks";

export type Product = {
  id: string;
  name: string;
  size: string;
  price: number;
  aisle: Aisle;
  emoji: string;
};

export type CartLine = { productId: string; qty: number };

export type Store = { id: string; name: string; area: string };

export type Order = {
  id: string;
  lines: { name: string; size: string; qty: number; price: number }[];
  fulfillment: "Pickup" | "Delivery";
  window: string;
  store: string;
  total: number;
  date: string;
};

export type GroceryState = {
  cart: CartLine[];
  orders: Order[];
  storeId: string;
};
