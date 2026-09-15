import React,{useCallback,useEffect,useState}from"react";
import{getWorkspaceTrips}from"../services/tripService";
import TripsLayout from"../layout/TripsLayout";
import SmartTripTable from"../components/SmartTripTable";
import TripCalendar from"../components/TripCalendar";
import{useAuth}from"../context/AuthContext";
import RequestTripButton from"../components/RequestTripButton";

const TRIP_CREATE="trip.create";
const AllTrips=()=>{
 const[trips,setTrips]=useState([]),[loadError,setLoadError]=useState(null);
 const{activeWorkspace}=useAuth();
 const canCreate=Boolean(activeWorkspace?.permissions?.includes(TRIP_CREATE));
 useEffect(()=>{const onTripUpdated=e=>{const updated=e?.detail;if(!updated?.id)return;setTrips(prev=>prev.map(t=>t.id===updated.id?{...t,...updated}:t));};window.addEventListener("trip:updated",onTripUpdated);return()=>window.removeEventListener("trip:updated",onTripUpdated);},[]);
 const fetchTrips=useCallback(async()=>{if(!activeWorkspace?.schoolId){setTrips([]);setLoadError(null);return;}try{setLoadError(null);setTrips(await getWorkspaceTrips(activeWorkspace.schoolId));}catch(error){console.error("Failed to fetch workspace trips:",error);setTrips([]);setLoadError(error?.response?.data?.message||"Unable to load trips for this workspace.");}},[activeWorkspace?.schoolId]);
 useEffect(()=>{fetchTrips();},[fetchTrips]);
 if(!activeWorkspace)return <div className="p-6 text-sm text-gray-600">No school workspace is available for this account.</div>;
 return <>
  {loadError&&<div className="mx-6 mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}
  <TripsLayout title={activeWorkspace.displayName?`${activeWorkspace.displayName} Trips`:"Trips"} trips={trips} tableComponent={SmartTripTable} calendarComponent={TripCalendar}/>
  {canCreate&&<RequestTripButton onSuccess={fetchTrips}/>} 
 </>;
};
export default AllTrips;
