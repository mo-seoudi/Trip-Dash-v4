// client/src/components/actions/TripActions.jsx
import React from "react";
import BusCompanyActions from "./BusCompanyActions"; // ← fixed
import StaffActions from "./StaffActions";           // ← fixed

const TripActions = ({ trip, profile, refreshCallback }) => {
  if (profile?.role === "bus_company") {
    return <BusCompanyActions trip={trip} refreshCallback={refreshCallback} />;
  }
  if (profile?.role === "school_staff") {
    return <StaffActions trip={trip} refreshCallback={refreshCallback} />;
  }
  return null;
};

export default TripActions;
