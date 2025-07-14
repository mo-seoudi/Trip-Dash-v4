import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const userData = docSnap.data();
            setFirebaseUser(user);
            setProfile({ uid: user.uid, email: user.email, ...userData });
          } else {
            console.error("User profile not found in Firestore!");
            setFirebaseUser(null);
            setProfile(null);
          }
        } catch (error) {
          console.error("Error fetching user profile:", error);
          setFirebaseUser(null);
          setProfile(null);
        }
      } else {
        setFirebaseUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = () => {
    signOut(auth);
    setFirebaseUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
