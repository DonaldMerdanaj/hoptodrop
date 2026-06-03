import type { User } from "@supabase/supabase-js";
import { ensureUserProfile } from "@/lib/authProfile";
import { supabase } from "@/lib/supabase";

export type RiderProfile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url: string;
  created_at?: string;
  updated_at?: string;
};

function metadataName(user: User) {
  const metadata = user.user_metadata || {};
  return metadata.full_name || metadata.name || user.email?.split("@")[0] || "HopToDrop rider";
}

function metadataAvatar(user: User) {
  const metadata = user.user_metadata || {};
  return metadata.avatar_url || metadata.picture || "";
}

export async function ensureRiderProfile(user: User) {
  if (!supabase) return null;
  await ensureUserProfile(user, "customer");

  const profile = {
    id: user.id,
    email: user.email || "",
    full_name: metadataName(user),
    avatar_url: metadataAvatar(user)
  };

  const { data, error } = await supabase
    .from("customer_profiles")
    .upsert(profile, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as RiderProfile;
}

export async function getRiderProfile(user: User) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("customer_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data as RiderProfile;
  return ensureRiderProfile(user);
}

export async function saveRiderProfile(user: User, values: { full_name?: string; phone?: string }) {
  if (!supabase) return null;

  const existing = await getRiderProfile(user);
  const profile = {
    id: user.id,
    email: user.email || existing?.email || "",
    full_name: values.full_name?.trim() || existing?.full_name || metadataName(user),
    phone: values.phone?.trim() || existing?.phone || "",
    avatar_url: existing?.avatar_url || metadataAvatar(user),
    updated_at: new Date().toISOString()
  };

  await supabase
    .from("profiles")
    .update({
      full_name: profile.full_name,
      phone: profile.phone,
      avatar_url: profile.avatar_url,
      updated_at: profile.updated_at
    })
    .eq("id", user.id)
    .eq("role", "customer");

  const { data, error } = await supabase
    .from("customer_profiles")
    .upsert(profile, { onConflict: "id" })
    .select("*")
    .single();

  if (error) throw error;
  return data as RiderProfile;
}
