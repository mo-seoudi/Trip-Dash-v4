import React,{useCallback,useEffect,useRef,useState}from"react";
import{getWorkspaceTrips}from"../services/tripService";
import TripsLayout from"../layout/TripsLayout";
import SmartTripTable from"../components/SmartTripTable";
import TripCalendar from"../components/TripCalendar";
import{useWorkspace}from"../context/WorkspaceContext";
import RequestTripButton from"../components/RequestTripButton";
import PageHeader from"../components/ui/PageHeader";

const TRIP_CREATE="trip.create";
const AllTrips=()=>{
 const[trips,setTrips]=useState([]),[loadError,setLoadError]=useState(null),[loading,setLoading]=useState(false);
 const{selectedWorkspace,workspaceEpoch}=useWorkspace();
 const schoolId=selectedWorkspace?.schoolId;
 const canCreate=Boolean(selectedWorkspace?.permissions?.includes(TRIP_CREATE));
 const requestRef=useRef(0);
 useEffect(()=>{setTrips([]);setLoadError(null);},[schoolId,workspaceEpoch]);
 useEffect(()=>{const onTripUpdated=e=>{const updated=e?.detail;if(!updated?.id)return;setTrips(prev=>prev.map(t=>t.id===updated.id?{...t,...updated}:t));};window.addEventListener("trip:updated",onTripUpdated);return()=>window.removeEventListener("trip:updated",onTripUpdated);},[]);
 const fetchTrips=useCallback(async()=>{const requestId=++requestRef.current;if(!schoolId){setTrips([]);setLoadError(null);setLoading(false);return;}try{setLoading(true);setLoadError(null);const result=await getWorkspaceTrips(schoolId);if(requestId===requestRef.current)setTrips(result);}catch(error){if(requestId!==requestRef.current)return;console.error("Failed to fetch workspace trips:",error);setTrips([]);setLoadError(error?.response?.data?.message||"Unable to load trips for this workspace.");}finally{if(requestId===requestRef.current)setLoading(false);}},[schoolId]);
 useEffect(()=>{fetchTrips();return()=>{requestRef.current++;};},[fetchTrips,workspaceEpoch]);
 if(!selectedWorkspace)return <div className="p-6 text-sm text-slate-600">No school workspace is available for this account.</div>;
 return <main key={schoolId} className="min-h-screen bg-slate-50/70 px-5 py-6 sm:px-7 lg:px-8">
   <div className="mx-auto max-w-[1600px] space-y-5">
     <PageHeader eyebrow={selectedWorkspace.displayName} title="Trips" description="The operational record of individual transport movements for this workspace." actions={canCreate?<RequestTripButton onSuccess={fetchTrips}/>:null}/>
     {loadError&&<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}
     {loading&&<div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm"><span className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-r-slate-700 align-[-2px]"/>Loading {selectedWorkspace.displayName} trips…</div>}
     <TripsLayout title="Operational trips" trips={trips} tableComponent={SmartTripTable} calendarComponent={TripCalendar}/>
   </div>
 </main>;
};
export default AllTrips;
