// src/services/authService.js
import { auth } from "../firebase";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";

export const loginUser = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async () => {
  return await signOut(auth);
};

export const getCurrentUser = () => {
  return auth.currentUser;
};
