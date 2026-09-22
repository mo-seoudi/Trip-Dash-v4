import React,{useState,useEffect,useContext,createContext,useCallback,useRef}from"react";
import{getSession,logout as logoutUser,getEffectiveAccess}from"../services/authService";
const AuthContext=createContext({tokenUser:null,profile:null,access:null,workspaces:[],activeWorkspace:null,setActiveWorkspaceId:()=>{},loading:true,refreshSession:async()=>{},logout:async()=>{}});
export const useAuth=()=>useContext(AuthContext);
export const AuthProvider=({children})=>{
 const[tokenUser,setTokenUser]=useState(null),[profile,setProfile]=useState(null),[access,setAccess]=useState(null),[activeWorkspaceId,setActiveWorkspaceIdState]=useState(null),[loading,setLoading]=useState(true);const refreshingRef=useRef(false),mountedRef=useRef(false);
 const fetchSessionAndProfile=useCallback(async()=>{const data=await getSession(),user=data?.user??null;setTokenUser(user);if(user){setProfile(user);try{const effectiveAccess=await getEffectiveAccess();setAccess(effectiveAccess);const available=effectiveAccess?.workspaces||[];setActiveWorkspaceIdState(current=>available.some(w=>w.schoolId===current)?current:(available[0]?.schoolId||null));}catch(err){const status=err?.response?.status;if(status===401)throw err;setAccess(null);setActiveWorkspaceIdState(null);}}else{setProfile(null);setAccess(null);setActiveWorkspaceIdState(null);}},[]);
 useEffect(()=>{mountedRef.current=true;(async()=>{try{setLoading(true);await fetchSessionAndProfile();}catch{setTokenUser(null);setProfile(null);setAccess(null);setActiveWorkspaceIdState(null);}finally{if(mountedRef.current)setLoading(false);}})();return()=>{mountedRef.current=false;};},[fetchSessionAndProfile]);
 const refreshSession=useCallback(async()=>{if(refreshingRef.current)return;refreshingRef.current=true;try{await fetchSessionAndProfile();}catch{}finally{refreshingRef.current=false;}},[fetchSessionAndProfile]);
 useEffect(()=>{const onVis=()=>{if(document.visibilityState==="visible")refreshSession({reason:"visibility"});};document.addEventListener("visibilitychange",onVis);return()=>document.removeEventListener("visibilitychange",onVis);},[refreshSession]);
 const logout=useCallback(async()=>{await logoutUser();setTokenUser(null);setProfile(null);setAccess(null);setActiveWorkspaceIdState(null);},[]);
 const workspaces=access?.workspaces||[];const activeWorkspace=workspaces.find(w=>w.schoolId===activeWorkspaceId)||null;
 const setActiveWorkspaceId=useCallback((schoolId)=>{const id=String(schoolId||"").trim();setActiveWorkspaceIdState(workspaces.some(w=>w.schoolId===id)?id:null);},[workspaces]);
 return <AuthContext.Provider value={{tokenUser,profile,access,workspaces,activeWorkspace,activeWorkspaceId,setActiveWorkspaceId,loading,refreshSession,logout}}>{children}</AuthContext.Provider>;
};
