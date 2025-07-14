import React from "react";
import { FcOvertime } from "react-icons/fc";
import { FaBus, FaUserGraduate, FaUserTie } from "react-icons/fa";
import ModalWrapper from "./ModalWrapper";

const TripDetailsPopup = ({ trip, onClose }) => {
  return (
    <ModalWrapper title={<span className="text-blue-700 font-bold">Trip Details</span>} onClose={onClose} maxWidth="max-w-lg">
      <div className="space-y-4">
        {/* Main Info */}
        <div>
          <h4 className="flex items-center font-semibold text-gray-700 mb-1 text-lg">
            <FcOvertime size={22} className="mr-2" />
            Main Information
          </h4>
          <div className="bg-gray-50 p-3 rounded-lg shadow-sm space-y-1 text-sm">
            <p><strong>Trip Type:</strong> {` ${trip.tripType === "Other" ? trip.customType : trip.tripType}`}</p>
            <p><strong>Destination:</strong> {` ${trip.destination}`}</p>
            <p><strong>Date:</strong> {` ${trip.date} at ${trip.departureTime}`}</p>
            <p><strong>Return:</strong> {` ${trip.returnDate} at ${trip.returnTime}`}</p>
            <p>
              <strong>Requested by:</strong> {` ${trip.createdBy || "N/A"}`}
              {trip.createdByEmail ? ` (${trip.createdByEmail})` : ""}
            </p>
          </div>
        </div>

        {/* Students & Notes */}
        <div>
          <h4 className="flex items-center font-semibold text-gray-700 mb-1 text-lg">
            <FaUserGraduate size={22} className="mr-2" />
            Students & Notes
          </h4>
          <div className="bg-gray-50 p-3 rounded-lg shadow-sm space-y-1 text-sm">
            <p><strong>Number of Students:</strong> {` ${trip.students}`}</p>
            <p><strong>Booster Seats:</strong> {` ${trip.boosterSeatsRequested ? `Yes (${trip.boosterSeatCount})` : "No"}`}</p>
            <p><strong>Notes:</strong> {` ${trip.notes || "None"}`}</p>
          </div>
        </div>

        {/* Bus Info */}
        {trip.busType && (
          <div>
            <h4 className="flex items-center font-semibold text-gray-700 mb-1 text-lg">
              <FaBus size={22} className="mr-2" />
              Bus Information
            </h4>
            <div className="bg-gray-50 p-3 rounded-lg shadow-sm space-y-1 text-sm">
              <p><strong>Bus Type:</strong> {` ${trip.busType}`}</p>
              <p><strong>Seats:</strong> {` ${trip.busSeats}`}</p>
              <p><strong>Trip Price:</strong> {trip.tripPrice ? ` ${trip.tripPrice} AED` : " N/A"}</p>
            </div>
          </div>
        )}

        {/* Driver Info */}
        {trip.driverName && (
          <div>
            <h4 className="flex items-center font-semibold text-gray-700 mb-1 text-lg">
              <FaUserTie size={22} className="mr-2" />
              Driver Information
            </h4>
            <div className="bg-gray-50 p-3 rounded-lg shadow-sm space-y-1 text-sm">
              <p><strong>Name:</strong> {` ${trip.driverName}`}</p>
              <p><strong>Phone:</strong> {` ${trip.driverPhone}`}</p>
            </div>
          </div>
        )}
      </div>
    </ModalWrapper>
  );
};

export default TripDetailsPopup;
