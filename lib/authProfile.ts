"use client";

import type { User } from "@supabase/supabase-js";
import { clearAccountMode, getAccountMode, setAccountMode, type AccountMode } from "@/lib/accountMode";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type AppRole = "customer" | "driver" | "admin";

export type CurrentUserProfile = {
  id: string;
  email: string;
  role: AppRole;
  full_name: string;
  phone: string;
  avatar_url: string;
  created_at?: string;
  updated_at?: string;
};

function metadataName(user: User) {
  const metadata = user.user_metadata || {};
  return metadata.full_name || metadata.name || user.email?.split("@")[0] || "HopToDrop user";
}

function metadataAvatar(user: User) {
  const metadata = user.user_metadata || {};
  return metadata.avatar_url || metadata.picture || "";
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function ensureUserProfile(user: User, requestedRole: Exclude<AppRole, "admin">) {
  if (!supabase) return null;

  const baseProfile = {
    id: user.id,
    email: user.email || "",
    role: requestedRole,
    full_name: metadataName(user),
    avatar_url: metadataAvatar(user),
    updated_at: new Date().toISOString()
  };

  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing as CurrentUserProfile;

  const { data, error } = await supabase
    .from("profiles")
    .insert(baseProfile)
    .select("*")
    .single();

  if (error) throw error;
  return data as CurrentUserProfile;
}

export async function getCurrentUserProfile() {
  const user = await getCurrentUser();
  if (!user || !supabase) return { user: null, profile: null };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  const profile = data as CurrentUserProfile | null;
  console.log("[auth]", {
    route: typeof window !== "undefined" ? window.location.pathname : "",
    userId: user.id,
    email: user.email,
    role: profile?.role || null
  });

  if (profile?.role === "customer" || profile?.role === "driver") setAccountMode(profile.role as AccountMode);
  if (!profile) clearAccountMode();

  return { user, profile };
}

export async function requireRole(allowedRoles: AppRole[]) {
  const { user, profile } = await getCurrentUserProfile();
  if (!user || !profile || !allowedRoles.includes(profile.role)) {
    return { user, profile, allowed: false };
  }

  if (profile.role === "customer" || profile.role === "driver") setAccountMode(profile.role);
  return { user, profile, allowed: true };
}

export function roleDashboard(role: AppRole | null | undefined) {
  if (role === "admin") return "/admin";
  if (role === "driver") return "/driver";
  return "/client/dashboard";
}

export function currentAccountModeRole() {
  return getAccountMode();
}
