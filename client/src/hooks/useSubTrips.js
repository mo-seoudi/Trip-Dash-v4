import { useEffect, useState } from "react";
import { getSubTripsByParent } from "../services/tripService";

export const useSubTrips = (parentTrips) => {
  const [subTripsMap, setSubTripsMap] = useState({});

  useEffect(() => {
    const loadAllSubTrips = async () => {
      const newMap = {};
      for (const trip of parentTrips) {
        try {
          const subTrips = await getSubTripsByParent(trip.id);
          if (subTrips.length > 0) {
            newMap[trip.id] = subTrips;
          }
        } catch (error) {
          console.error("Error loading sub-trips for trip", trip.id, error);
        }
      }
      setSubTripsMap(newMap);
    };

    if (parentTrips && parentTrips.length > 0) {
      loadAllSubTrips();
    }
  }, [parentTrips]);

  return { subTripsMap };
};
