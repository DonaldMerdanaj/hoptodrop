"use client";

export type AccountMode = "customer" | "driver";

const accountModeKey = "hoptodrop_account_mode";
const authIntentKey = "hoptodrop_auth_intent";

function cookieDomain() {
  if (typeof window === "undefined") return "";
  const hostname = window.location.hostname;
  if (hostname === "hoptodrop.com" || hostname === "www.hoptodrop.com" || hostname === "driver.hoptodrop.com") {
    return "; domain=.hoptodrop.com";
  }

  return "";
}

function cookieSecure() {
  if (typeof window === "undefined") return "";
  return window.location.protocol === "https:" ? "; Secure" : "";
}

export function setAccountMode(mode: AccountMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(accountModeKey, mode);
}

export function getAccountMode() {
  if (typeof window === "undefined") return null;
  const mode = window.localStorage.getItem(accountModeKey);
  return mode === "driver" || mode === "customer" ? mode : null;
}

export function clearAccountMode() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(accountModeKey);
}

export function setAuthIntent(mode: AccountMode) {
  if (typeof document === "undefined") return;
  // fix: OAuth can occasionally return to the Supabase Site URL, so keep driver/rider intent across subdomains briefly.
  document.cookie = `${authIntentKey}=${mode}; path=/; max-age=900; SameSite=Lax${cookieDomain()}${cookieSecure()}`;
}

export function getAuthIntent() {
  if (typeof document === "undefined") return null;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${authIntentKey}=`));
  const value = cookie?.split("=")[1];
  return value === "driver" || value === "customer" ? value : null;
}

export function clearAuthIntent() {
  if (typeof document === "undefined") return;
  document.cookie = `${authIntentKey}=; path=/; max-age=0; SameSite=Lax${cookieDomain()}${cookieSecure()}`;
}
