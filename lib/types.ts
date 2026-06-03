export type DriverLocation = {
  id: string;
  driver_name: string;
  vehicle: string | null;
  status: "online" | "offline" | "busy";
  lat: number;
  lng: number;
  updated_at: string;
};

export type BookingStatus = "pending" | "accepted" | "assigned" | "arrived" | "started" | "completed" | "cancelled";

export type Booking = {
  id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  pickup: string;
  dropoff: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  pickup_time: string;
  passengers: number;
  luggage: string | null;
  vehicle_type: string;
  ride_class: string;
  payment_method: string;
  driver_id: string | null;
  driver_name: string | null;
  driver_vehicle: string | null;
  driver_eta: number | null;
  estimated_price: number;
  status: BookingStatus;
  accepted_at: string | null;
  arrived_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type BookingPayload = {
  customer_name: string;
  customer_phone: string;
  pickup: string;
  dropoff: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  pickup_time: string;
  passengers: number;
  luggage: string;
  vehicle_type: string;
  ride_class: string;
  payment_method: string;
  estimated_price: number;
};

export type BookingRoutePoint = {
  id: string;
  booking_id: string;
  driver_id: string;
  lat: number;
  lng: number;
  phase: "assigned" | "accepted" | "arrived" | "started" | "completed";
  recorded_at: string;
};

export type RiderProfile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
};

export type DriverProfile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  city: string;
  national_id?: string | null;
  license_number?: string | null;
  license_expires_at?: string | null;
  taxi_license_number?: string | null;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_year?: number | null;
  license_plate: string;
  vehicle_color: string;
  seats?: number | null;
  iban?: string | null;
  driver_license_url: string | null;
  vehicle_registration_url: string | null;
  insurance_url: string | null;
  profile_photo_url: string | null;
  approval_status: "draft" | "submitted" | "approved" | "rejected";
  status: "online" | "offline" | "busy";
  submitted_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TripHistory = {
  id: string;
  booking_id: string;
  customer_id: string;
  driver_id: string;
  pickup: string;
  dropoff: string;
  fare: number;
  status: "completed" | "cancelled";
  completed_at: string | null;
  created_at: string;
};

export type Earning = {
  id: string;
  driver_id: string;
  booking_id: string | null;
  amount: number;
  currency: string;
  earned_on: string;
  created_at: string;
};
