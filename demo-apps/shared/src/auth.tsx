import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { getItem, setItem } from "./storage.ts";
import { DEMO_USER } from "./demoUser.ts";

export type AuthState = {
  loggedIn: boolean;
  username: string;
  name: string;
};

export type AuthContextValue = AuthState & {
  login: (username: string, password: string) => boolean;
  logout: () => void;
};

const EMPTY_STATE: AuthState = { loggedIn: false, username: "", name: "" };

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  prefix,
  children,
}: {
  prefix: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<AuthState>(() =>
    getItem(prefix, "auth", EMPTY_STATE),
  );

  useEffect(() => {
    setItem(prefix, "auth", state);
  }, [prefix, state]);

  const login = (username: string, password: string): boolean => {
    if (username === DEMO_USER.username && password === DEMO_USER.password) {
      setState({ loggedIn: true, username, name: DEMO_USER.name });
      return true;
    }
    return false;
  };

  const logout = () => setState(EMPTY_STATE);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  if (!auth.loggedIn) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}
