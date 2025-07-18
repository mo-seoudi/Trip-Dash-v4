import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return setProfile(null);

      const res = await fetch("/api/auth/profile", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error("Unauthorized");

      const data = await res.json();
      setProfile(data);
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const logout = () => {
    localStorage.removeItem("token");
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
