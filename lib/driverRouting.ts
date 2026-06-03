"use client";

import { supabase } from "@/lib/supabase";

export async function driverDestination(userId: string) {
  if (!supabase) return "/driver/formaplication";

  const { data } = await supabase
    .from("driver_profiles")
    .select("approval_status")
    .eq("id", userId)
    .maybeSingle();

  return data?.approval_status === "approved" ? "/driver" : "/driver/formaplication";
}
