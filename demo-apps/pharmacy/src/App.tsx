import { Route, Routes } from "react-router";
import { RequireAuth, ResetRoute, ToastHost } from "@demo/shared";
import Header from "./components/Header.tsx";
import Footer from "./components/Footer.tsx";
import { PharmacyStateProvider } from "./state/PharmacyStateContext.tsx";
import Home from "./pages/Home.tsx";
import Login from "./pages/Login.tsx";
import PharmacyHub from "./pages/PharmacyHub.tsx";
import Refills from "./pages/Refills.tsx";
import RefillsReview from "./pages/RefillsReview.tsx";
import RefillsDone from "./pages/RefillsDone.tsx";
import Orders from "./pages/Orders.tsx";
import Care from "./pages/Care.tsx";
import AppointmentNew from "./pages/AppointmentNew.tsx";
import Appointments from "./pages/Appointments.tsx";
import AccountHealth from "./pages/AccountHealth.tsx";

export default function App() {
  return (
    <PharmacyStateProvider>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset" element={<ResetRoute prefix="sunplaza:" />} />
          <Route path="/pharmacy" element={<PharmacyHub />} />
          <Route
            path="/pharmacy/refills"
            element={
              <RequireAuth>
                <Refills />
              </RequireAuth>
            }
          />
          <Route
            path="/pharmacy/refills/review"
            element={
              <RequireAuth>
                <RefillsReview />
              </RequireAuth>
            }
          />
          <Route
            path="/pharmacy/refills/done"
            element={
              <RequireAuth>
                <RefillsDone />
              </RequireAuth>
            }
          />
          <Route
            path="/pharmacy/orders"
            element={
              <RequireAuth>
                <Orders />
              </RequireAuth>
            }
          />
          <Route path="/care" element={<Care />} />
          <Route
            path="/care/appointments/new"
            element={
              <RequireAuth>
                <AppointmentNew />
              </RequireAuth>
            }
          />
          <Route
            path="/care/appointments"
            element={
              <RequireAuth>
                <Appointments />
              </RequireAuth>
            }
          />
          <Route
            path="/account/health"
            element={
              <RequireAuth>
                <AccountHealth />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
      <ToastHost />
    </PharmacyStateProvider>
  );
}
