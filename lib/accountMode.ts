"use client";

export type AccountMode = "customer" | "driver";

const accountModeKey = "hoptodrop_account_mode";

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
