import { useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router";
import { RequireAuth, ResetRoute, ToastHost } from "@demo/shared";
import Header from "./components/Header.tsx";
import Footer from "./components/Footer.tsx";
import PaperlessModal from "./components/PaperlessModal.tsx";
import { BankStateProvider } from "./state/BankStateContext.tsx";
import Home from "./pages/Home.tsx";
import Login from "./pages/Login.tsx";
import Accounts from "./pages/Accounts.tsx";
import AccountDetail from "./pages/AccountDetail.tsx";
import PayCard from "./pages/PayCard.tsx";
import PayBills from "./pages/PayBills.tsx";
import Transfer from "./pages/Transfer.tsx";
import Spending from "./pages/Spending.tsx";
import Statements from "./pages/Statements.tsx";
import Help from "./pages/Help.tsx";
import MessageNew from "./pages/MessageNew.tsx";
import Messages from "./pages/Messages.tsx";
import Profile from "./pages/Profile.tsx";

export const POPUP_FLAG = "harbor:pop-paperless";

function AppInner() {
  const location = useLocation();
  const [showPaperless, setShowPaperless] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(POPUP_FLAG) === "1") {
      sessionStorage.removeItem(POPUP_FLAG);
      setShowPaperless(true);
    }
  }, [location.pathname]);

  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset" element={<ResetRoute prefix="harbor:" />} />
          <Route
            path="/accounts"
            element={
              <RequireAuth>
                <Accounts />
              </RequireAuth>
            }
          />
          <Route
            path="/accounts/:type"
            element={
              <RequireAuth>
                <AccountDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/pay-card"
            element={
              <RequireAuth>
                <PayCard />
              </RequireAuth>
            }
          />
          <Route
            path="/pay-bills"
            element={
              <RequireAuth>
                <PayBills />
              </RequireAuth>
            }
          />
          <Route
            path="/transfer"
            element={
              <RequireAuth>
                <Transfer />
              </RequireAuth>
            }
          />
          <Route
            path="/spending"
            element={
              <RequireAuth>
                <Spending />
              </RequireAuth>
            }
          />
          <Route
            path="/statements"
            element={
              <RequireAuth>
                <Statements />
              </RequireAuth>
            }
          />
          <Route path="/help" element={<Help />} />
          <Route
            path="/messages/new"
            element={
              <RequireAuth>
                <MessageNew />
              </RequireAuth>
            }
          />
          <Route
            path="/messages"
            element={
              <RequireAuth>
                <Messages />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
      <ToastHost />
      {showPaperless && <PaperlessModal onClose={() => setShowPaperless(false)} />}
    </>
  );
}

export default function App() {
  return (
    <BankStateProvider>
      <AppInner />
    </BankStateProvider>
  );
}
