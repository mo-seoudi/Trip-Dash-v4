// 📄 File path: src/services/authService.js
import api from "./apiClient";
export const login=async(email,password)=>{const res=await api.post("/auth/login",{email,password});return res.data;};
export const logout=async()=>{try{await api.post("/auth/logout");}finally{localStorage.removeItem("token");}};
export const getSession=async()=>{const res=await api.get("/auth/session");return res.data;};
export const getUserProfile=async(uid)=>{const res=await api.get(`/users/${uid}`);return res.data;};
// Backend-owned authorization/workspace bootstrap. UI must use this contract
// rather than deriving workspace access from profile role strings.
export const getEffectiveAccess=async()=>{const res=await api.get("/access/me");return res.data;};
