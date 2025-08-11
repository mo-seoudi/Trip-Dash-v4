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
      const data = await getSession(); // expects { user } or 401
      const user = data?.user ?? null;
      setTokenUser(user);

      if (user) {
        const userProfile = await getUserProfile(user.id);
        setProfile(userProfile);
      } else {
        setProfile(null);
      }
    } catch (error) {
      // swallow 401s; they just mean "not logged in"
      setTokenUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshSession = useCallback(() => loadSession(), [loadSession]);

  const logout = useCallback(async () => {
    await logoutUser();
    setTokenUser(null);
    setProfile(null);
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <AuthContext.Provider
      value={{ tokenUser, profile, loading, refreshSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
