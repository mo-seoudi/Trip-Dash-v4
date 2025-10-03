// src/context/AuthContext.js
import React, {
  useState,
  useEffect,
  useContext,
  createContext,
  useCallback,
} from "react";
import {
  getSession,
  logout as logoutUser,
  getUserProfile,
} from "../services/authService";

const AuthContext = createContext({
  tokenUser: null,
  profile: null,
  loading: true,
  refreshSession: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [tokenUser, setTokenUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      // getSession should call /api/auth/session with credentials: 'include'
      const data = await getSession(); // { user } or 401 thrown/caught below
      const user = data?.user ?? null;
      setTokenUser(user);

      if (user) {
        try {
          const userProfile = await getUserProfile(user.id);
          setProfile(userProfile);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    } catch {
      // Treat network/401 as "not logged in"
      setTokenUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(() => loadSession(), [loadSession]);

  const logout = useCallback(async () => {
    try {
      await logoutUser(); // hits /api/auth/logout
    } finally {
      setTokenUser(null);
      setProfile(null);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  // Optional: refresh when the tab becomes visible (handles cookie changes)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") loadSession();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadSession]);

  return (
    <AuthContext.Provider
      value={{ tokenUser, profile, loading, refreshSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
