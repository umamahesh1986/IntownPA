import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "@/lib/api";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=anon, object=auth
  const [lang, setLang] = useState(localStorage.getItem("intownpa_lang") || "en");

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("intownpa_token");
    if (!token) { setUser(false); return; }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("intownpa_token");
      setUser(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const sendOtp = async (mobile) => {
    const { data } = await api.post("/auth/send-otp", { mobile });
    return data;
  };

  const verifyOtp = async (mobile, otp, name, role) => {
    const { data } = await api.post("/auth/verify-otp", { mobile, otp, name, role });
    localStorage.setItem("intownpa_token", data.token);
    setUser(data.user);
    return data;
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("intownpa_token");
    setUser(false);
  };

  const updateUser = (u) => setUser(u);

  const changeLang = (l) => { setLang(l); localStorage.setItem("intownpa_lang", l); };

  return (
    <AuthContext.Provider value={{ user, lang, sendOtp, verifyOtp, logout, updateUser, loadMe, changeLang }}>
      {children}
    </AuthContext.Provider>
  );
}
