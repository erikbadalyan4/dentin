import { createContext, useContext, useState, useCallback } from "react";

const API = "http://localhost:54794/api/auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("dentin_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email, password) => {
    const res = await fetch(`${API}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Ошибка входа");
    }
    const data = await res.json();
    localStorage.setItem("dentin_token", data.token);
    localStorage.setItem("dentin_user", JSON.stringify({ username: data.username, email: data.email }));
    setUser({ username: data.username, email: data.email });
  }, []);

  const register = useCallback(async (username, email, password) => {
    const res = await fetch(`${API}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Ошибка регистрации");
    }
    const data = await res.json();
    localStorage.setItem("dentin_token", data.token);
    localStorage.setItem("dentin_user", JSON.stringify({ username: data.username, email: data.email }));
    setUser({ username: data.username, email: data.email });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("dentin_token");
    localStorage.removeItem("dentin_user");
    setUser(null);
  }, []);

  // Хелпер для fetch с токеном
  const authFetch = useCallback(async (url, options = {}) => {
    const token = localStorage.getItem("dentin_token");
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
