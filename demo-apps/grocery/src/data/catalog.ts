import type { Aisle, Product, Store } from "./types.ts";

export const STORES: Store[] = [
  { id: "aisle8", name: "Aisle 8 Market", area: "Coral Way" },
  { id: "palma", name: "Palma Supermarket", area: "Flagler" },
  { id: "greenleaf", name: "GreenLeaf Organics", area: "Brickell" },
];

export const AISLES: Aisle[] = [
  "Produce",
  "Dairy & Eggs",
  "Bakery",
  "Meat & Seafood",
  "Pantry",
  "Frozen",
  "Beverages",
  "Snacks",
];

function p(id: string, name: string, size: string, price: number, aisle: Aisle, emoji: string): Product {
  return { id, name, size, price, aisle, emoji };
}

export const CATALOG: Product[] = [
  // Produce
  p("prod-bananas", "Bananas", "per lb", 0.59, "Produce", "🍌"),
  p("prod-tomatoes", "Roma Tomatoes", "per lb", 1.79, "Produce", "🍅"),
  p("prod-avocados", "Avocados", "2 ct", 2.49, "Produce", "🥑"),
  p("prod-carrots", "Baby Carrots", "16 oz bag", 1.99, "Produce", "🥕"),
  p("prod-peppers", "Bell Peppers", "3 ct", 3.49, "Produce", "🫑"),
  p("prod-lettuce", "Romaine Lettuce", "1 head", 2.29, "Produce", "🥬"),

  // Dairy & Eggs
  p("dairy-whole-milk", "Whole Milk", "1 gal", 4.29, "Dairy & Eggs", "🥛"),
  p("dairy-2pct-milk", "2% Reduced Fat Milk", "1 gal", 4.19, "Dairy & Eggs", "🥛"),
  p("dairy-organic-milk", "Organic Whole Milk", "half gal", 5.49, "Dairy & Eggs", "🥛"),
  p("dairy-lactosefree-milk", "Lactose-Free 2% Milk", "half gal", 4.79, "Dairy & Eggs", "🥛"),
  p("dairy-almond-milk", "Unsweetened Almond Milk", "half gal", 3.99, "Dairy & Eggs", "🥛"),
  p("dairy-white-eggs-12", "Large White Eggs", "12 ct", 3.49, "Dairy & Eggs", "🥚"),
  p("dairy-brown-eggs-12", "Large Brown Eggs", "12 ct", 4.29, "Dairy & Eggs", "🥚"),
  p("dairy-organic-eggs-12", "Organic Free-Range Eggs", "12 ct", 5.99, "Dairy & Eggs", "🥚"),
  p("dairy-white-eggs-18", "Large White Eggs", "18 ct", 4.99, "Dairy & Eggs", "🥚"),
  p("dairy-butter", "Salted Butter", "1 lb", 4.49, "Dairy & Eggs", "🧈"),
  p("dairy-yogurt", "Greek Yogurt", "32 oz", 5.29, "Dairy & Eggs", "🥣"),

  // Bakery
  p("bakery-white-bread", "White Sandwich Bread", "20 oz", 2.99, "Bakery", "🍞"),
  p("bakery-wheat-bread", "100% Whole Wheat Bread", "20 oz", 3.49, "Bakery", "🍞"),
  p("bakery-sourdough", "Sourdough Bread", "24 oz", 4.99, "Bakery", "🍞"),
  p("bakery-cuban-bread", "Cuban Bread", "16 oz", 2.49, "Bakery", "🍞"),
  p("bakery-bagels", "Bagels", "6 ct", 3.99, "Bakery", "🥯"),
  p("bakery-muffins", "Blueberry Muffins", "4 ct", 4.49, "Bakery", "🧁"),

  // Meat & Seafood
  p("meat-chicken-breast", "Boneless Chicken Breast", "per lb", 5.99, "Meat & Seafood", "🍗"),
  p("meat-ground-beef", "Ground Beef 80/20", "per lb", 5.49, "Meat & Seafood", "🥩"),
  p("meat-pork-chops", "Center-Cut Pork Chops", "per lb", 4.99, "Meat & Seafood", "🥩"),
  p("meat-salmon", "Atlantic Salmon Fillet", "per lb", 9.99, "Meat & Seafood", "🐟"),
  p("meat-shrimp", "Large Shrimp", "per lb", 8.99, "Meat & Seafood", "🦐"),
  p("meat-bacon", "Applewood Bacon", "12 oz", 5.49, "Meat & Seafood", "🥓"),

  // Pantry
  p("pantry-olive-oil", "Extra Virgin Olive Oil", "16 oz", 7.99, "Pantry", "🫒"),
  p("pantry-pasta", "Penne Pasta", "16 oz", 1.79, "Pantry", "🍝"),
  p("pantry-marinara", "Marinara Sauce", "24 oz", 3.29, "Pantry", "🥫"),
  p("pantry-rice", "White Rice", "2 lb", 2.99, "Pantry", "🍚"),
  p("pantry-peanut-butter", "Peanut Butter", "16 oz", 3.49, "Pantry", "🥜"),
  p("pantry-flour", "All-Purpose Flour", "5 lb", 3.99, "Pantry", "🌾"),
  p("pantry-sugar", "Granulated Sugar", "4 lb", 2.79, "Pantry", "🧂"),

  // Frozen
  p("frozen-veggies", "Frozen Mixed Vegetables", "12 oz", 1.99, "Frozen", "🥦"),
  p("frozen-icecream", "Vanilla Ice Cream", "48 oz", 4.99, "Frozen", "🍦"),
  p("frozen-pizza", "Frozen Pepperoni Pizza", "12 in", 5.49, "Frozen", "🍕"),
  p("frozen-nuggets", "Frozen Chicken Nuggets", "24 oz", 6.49, "Frozen", "🍗"),
  p("frozen-waffles", "Frozen Waffles", "10 ct", 3.29, "Frozen", "🧇"),
  p("frozen-mango", "Frozen Mango Chunks", "16 oz", 3.99, "Frozen", "🥭"),

  // Beverages
  p("bev-oj", "Orange Juice", "59 oz", 3.99, "Beverages", "🧃"),
  p("bev-sparkling", "Sparkling Water", "12 pk", 4.49, "Beverages", "🫧"),
  p("bev-cola", "Cola", "12 pk", 5.49, "Beverages", "🥤"),
  p("bev-coffee", "Ground Coffee", "12 oz", 7.99, "Beverages", "☕"),
  p("bev-tea", "Green Tea Bags", "20 ct", 3.49, "Beverages", "🍵"),
  p("bev-water", "Bottled Water", "24 pk", 4.99, "Beverages", "💧"),

  // Snacks
  p("snack-chips", "Tortilla Chips", "12 oz", 3.29, "Snacks", "🌽"),
  p("snack-salsa", "Salsa", "16 oz", 2.99, "Snacks", "🍅"),
  p("snack-nuts", "Mixed Nuts", "10 oz", 5.99, "Snacks", "🥜"),
  p("snack-pretzels", "Pretzels", "14 oz", 2.79, "Snacks", "🥨"),
  p("snack-cookies", "Chocolate Chip Cookies", "14 oz", 3.99, "Snacks", "🍪"),
  p("snack-popcorn", "Popcorn", "3 pk", 3.49, "Snacks", "🍿"),
];

export function productById(id: string): Product | undefined {
  return CATALOG.find((c) => c.id === id);
}

export function searchProducts(query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CATALOG.filter((p) => {
    if (p.name.toLowerCase().includes(q)) return true;
    // Match the aisle's own primary word (e.g. "produce", "snacks", "meat"),
    // not a substring of the whole aisle name: "Dairy & Eggs" contains the
    // word "eggs", which would otherwise pull every milk/butter/yogurt
    // product into a search for "eggs" just because they share that aisle.
    const aisleFirstWord = p.aisle.toLowerCase().split(/[^a-z0-9]+/)[0];
    return aisleFirstWord.length > 0 && (aisleFirstWord === q || aisleFirstWord.startsWith(q));
  });
}
