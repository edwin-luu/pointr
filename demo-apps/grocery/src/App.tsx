import { Route, Routes } from "react-router";
import { ResetRoute, ToastHost } from "@demo/shared";
import Header from "./components/Header.tsx";
import { GroceryStateProvider } from "./state/GroceryStateContext.tsx";
import Home from "./pages/Home.tsx";
import Search from "./pages/Search.tsx";
import Aisle from "./pages/Aisle.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import SignIn from "./pages/SignIn.tsx";
import Checkout from "./pages/Checkout.tsx";
import OrderConfirm from "./pages/OrderConfirm.tsx";
import Orders from "./pages/Orders.tsx";

export default function App() {
  return (
    <GroceryStateProvider>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/aisle/:slug" element={<Aisle />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/signin" element={<SignIn />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders/:id" element={<OrderConfirm />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/reset" element={<ResetRoute prefix="freshcart:" />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <footer className="gc-footer">FreshCart is a made-up grocery app created for this demo.</footer>
      <ToastHost />
    </GroceryStateProvider>
  );
}
