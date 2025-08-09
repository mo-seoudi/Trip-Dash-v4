// 📄 File path: src/context/AuthContext.js

import React, { useState, useEffect, useContext, createContext } from "react";
import { getSession, logout as logoutUser, getUserProfile } from "../services/authService";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [tokenUser, setTokenUser] = useState(null); // Renamed from firebaseUser
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadSession = async () => {
    try {
      const session = await getSession(); // returns user with token if logged in
      if (session && session.user && session.token) {
        setTokenUser(session.user);
        const userProfile = await getUserProfile(session.user.id);
        setProfile(userProfile);
      } else {
        setTokenUser(null);
        setProfile(null);
      }
    } catch (error) {
      console.error("Error loading session:", error);
      setTokenUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await logoutUser();
    setTokenUser(null);
    setProfile(null);
  };

  useEffect(() => {
    loadSession();
  }, []);

  return (
    <AuthContext.Provider value={{ tokenUser, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
