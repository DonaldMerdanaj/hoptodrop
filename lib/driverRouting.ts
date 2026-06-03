"use client";

import { supabase } from "@/lib/supabase";

export function driverHomePath() {
  if (typeof window !== "undefined" && window.location.hostname === "driver.hoptodrop.com") {
    return "/";
  }

  return "/driver";
}

export async function driverDestination(userId: string) {
  if (!supabase) return "/driver/application";

  const { data } = await supabase
    .from("driver_profiles")
    .select("approval_status")
    .eq("id", userId)
    .maybeSingle();

  return data?.approval_status === "approved" ? driverHomePath() : "/driver/application";
}
