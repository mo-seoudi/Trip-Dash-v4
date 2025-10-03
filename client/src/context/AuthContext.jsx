// src/context/AuthContext.js
import React, {
  useState,
  useEffect,
  useContext,
  createContext,
  useCallback,
  useRef,
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
  refreshSession: async (_opts) => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [tokenUser, setTokenUser] = useState(null);
  const [profile, setProfile] = useState(null);

  // only used for the *first* load gate in App.jsx
  const [loading, setLoading] = useState(true);

  // guards to prevent overlapping refreshes or flicker
  const refreshingRef = useRef(false);
  const mountedRef = useRef(false);

  const fetchSessionAndProfile = useCallback(async () => {
    const data = await getSession(); // expects { user } or 401
    const user = data?.user ?? null;
    setTokenUser(user);

    if (user) {
      const userProfile = await getUserProfile(user.id);
      setProfile(userProfile);
    } else {
      setProfile(null);
    }
  }, []);

  // Initial mount: do a "hard" load that can show the loading gate
  useEffect(() => {
    mountedRef.current = true;
    (async () => {
      try {
        setLoading(true);
        await fetchSessionAndProfile();
      } catch {
        setTokenUser(null);
        setProfile(null);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, [fetchSessionAndProfile]);

  // Soft, background refresh (doesn't flip the global 'loading' flag)
  const refreshSession = useCallback(
    async ({ reason } = {}) => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      try {
        await fetchSessionAndProfile();
      } catch {
        // swallow; keep current UI – user can still log back in if needed
      } finally {
        refreshingRef.current = false;
      }
    },
    [fetchSessionAndProfile]
  );

  // OPTIONAL: If you *do* want to refetch when tab becomes visible, keep it soft.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") {
        // soft refresh; no full-page "Loading..." flicker
        refreshSession({ reason: "visibility" });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refreshSession]);

  const logout = useCallback(async () => {
    await logoutUser();
    setTokenUser(null);
    setProfile(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ tokenUser, profile, loading, refreshSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

