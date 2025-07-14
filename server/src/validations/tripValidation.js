import { z } from "zod";

// Schema for creating a trip
export const createTripSchema = z.object({
  destination: z.string().min(1, "Destination is required"),
  date: z.string().min(1, "Date is required"), // Could add date format check if needed
  time: z.string().min(1, "Time is required"),
  returnTime: z.string().optional(),
  numberOfStudents: z.number().min(1, "At least 1 student"),
  numberOfStaff: z.number().min(0).default(0),
  tripType: z.string().min(1, "Trip type is required"),
  boosterSeats: z.number().min(0).default(0),
  // Add other fields as needed
});

// Schema for updating trip status
export const updateStatusSchema = z.object({
  status: z.enum(["Pending", "Accepted", "Confirmed", "Completed", "Canceled"]),
});
