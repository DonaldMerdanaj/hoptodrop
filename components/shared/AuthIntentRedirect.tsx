"use client";

import { useEffect } from "react";
import { clearAuthIntent, getAuthIntent } from "@/lib/accountMode";
import { supabase } from "@/lib/supabase";

function isMainHost(hostname: string) {
  return hostname === "hoptodrop.com" || hostname === "www.hoptodrop.com" || hostname === "hoptodrop.vercel.app";
}

function driverCallbackUrl(search: string, hash: string) {
  const params = new URLSearchParams(search);
  params.set("mode", "driver");
  params.set("method", params.get("method") || "google");
  params.set("next", "https://driver.hoptodrop.com/");
  return `https://driver.hoptodrop.com/auth/callback?${params.toString()}${hash}`;
}

export default function AuthIntentRedirect() {
  useEffect(() => {
    async function recoverDriverOauthReturn() {
      const intent = getAuthIntent();
      if (intent !== "driver" || !isMainHost(window.location.hostname)) return;

      const hasOauthPayload =
        window.location.search.includes("code=") ||
        window.location.hash.includes("access_token=") ||
        window.location.hash.includes("refresh_token=");

      if (hasOauthPayload) {
        // fix: recover driver Google logins if Supabase returns to the main Site URL instead of the driver callback.
        window.location.replace(driverCallbackUrl(window.location.search, window.location.hash));
        return;
      }

      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (data.session?.access_token && data.session.refresh_token) {
        const hash = `#access_token=${encodeURIComponent(data.session.access_token)}&refresh_token=${encodeURIComponent(data.session.refresh_token)}`;
        window.location.replace(driverCallbackUrl("", hash));
        return;
      }

      clearAuthIntent();
    }

    recoverDriverOauthReturn();
  }, []);

  return null;
}
