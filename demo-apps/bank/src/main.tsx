import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "@demo/shared";
import "./styles.css";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider prefix="harbor:">
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
