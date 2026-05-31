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
