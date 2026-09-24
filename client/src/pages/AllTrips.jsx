import React,{useCallback,useEffect,useRef,useState}from"react";
import{getWorkspaceTrips}from"../services/tripService";
import TripsLayout from"../layout/TripsLayout";
import SmartTripTable from"../components/SmartTripTable";
import TripCalendar from"../components/TripCalendar";
import{useWorkspace}from"../context/WorkspaceContext";
import RequestTripButton from"../components/RequestTripButton";

const TRIP_CREATE="trip.create";
const AllTrips=()=>{
 const[trips,setTrips]=useState([]),[loadError,setLoadError]=useState(null),[loading,setLoading]=useState(false);
 const{selectedWorkspace,workspaceEpoch}=useWorkspace();
 const schoolId=selectedWorkspace?.schoolId;
 const canCreate=Boolean(selectedWorkspace?.permissions?.includes(TRIP_CREATE));
 const requestRef=useRef(0);

 useEffect(()=>{setTrips([]);setLoadError(null);},[schoolId,workspaceEpoch]);
 useEffect(()=>{const onTripUpdated=e=>{const updated=e?.detail;if(!updated?.id)return;setTrips(prev=>prev.map(t=>t.id===updated.id?{...t,...updated}:t));};window.addEventListener("trip:updated",onTripUpdated);return()=>window.removeEventListener("trip:updated",onTripUpdated);},[]);
 const fetchTrips=useCallback(async()=>{
   const requestId=++requestRef.current;
   if(!schoolId){setTrips([]);setLoadError(null);setLoading(false);return;}
   try{setLoading(true);setLoadError(null);const result=await getWorkspaceTrips(schoolId);if(requestId===requestRef.current)setTrips(result);}
   catch(error){if(requestId!==requestRef.current)return;console.error("Failed to fetch workspace trips:",error);setTrips([]);setLoadError(error?.response?.data?.message||"Unable to load trips for this workspace.");}
   finally{if(requestId===requestRef.current)setLoading(false);}
 },[schoolId]);
 useEffect(()=>{fetchTrips();return()=>{requestRef.current++;};},[fetchTrips,workspaceEpoch]);
 if(!selectedWorkspace)return <div className="p-6 text-sm text-gray-600">No school workspace is available for this account.</div>;
 return <div key={schoolId}>
  <div className="mb-5 rounded-xl border border-violet-100 bg-white px-4 py-3 shadow-sm"><span className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-500">School workspace</span><div className="mt-0.5 flex items-baseline gap-2"><h1 className="text-xl font-bold text-gray-900">{selectedWorkspace.displayName}</h1><span className="text-sm text-gray-400">/ All Trips</span></div></div>
  {loadError&&<div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}
  {loading&&<div className="mb-4 text-sm text-gray-500">Loading {selectedWorkspace.displayName} trips…</div>}
  <TripsLayout title="Trips" trips={trips} tableComponent={SmartTripTable} calendarComponent={TripCalendar}/>
  {canCreate&&<RequestTripButton onSuccess={fetchTrips}/>} 
 </div>;
};
export default AllTrips;
