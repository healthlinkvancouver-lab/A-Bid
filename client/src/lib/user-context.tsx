import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "./api";
import { API } from "./api";
import { queryClient } from "./queryClient";

interface UserContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, role: "guest" | "owner") => Promise<User>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  login: async () => { throw new Error("not ready"); },
  register: async () => { throw new Error("not ready"); },
  logout: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on load (P0-3: real auth replaces the demo user switcher)
  useEffect(() => {
    API.getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await API.login(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, role: "guest" | "owner") => {
    const u = await API.register(name, email, password, role);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await API.logout().catch(() => {});
    setUser(null);
    queryClient.clear();
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

export function dashboardRouteFor(role: string): string {
  return role === "owner" ? "/owner/dashboard" : role === "admin" ? "/admin/dashboard" : "/guest/dashboard";
}
