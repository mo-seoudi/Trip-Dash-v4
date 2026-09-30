import React, { useState } from "react";
import { FiPlus } from "react-icons/fi";
import TripForm from "./TripForm";
import ModalWrapper from "./ModalWrapper";
import Button from "./ui/Button";

export default function RequestTripButton({ onSuccess, hidden = false }) {
  const [open, setOpen] = useState(false);

  if (hidden) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <FiPlus size={16} />
        Request trip
      </Button>

      {open && (
        <ModalWrapper
          title="Request a new trip"
          description="Enter the journey, passenger and timing details for this request."
          onClose={() => setOpen(false)}
          maxWidth="max-w-3xl"
        >
          <TripForm
            onSuccess={() => {
              setOpen(false);
              onSuccess?.();
            }}
            onClose={() => setOpen(false)}
          />
        </ModalWrapper>
      )}
    </>
  );
}
