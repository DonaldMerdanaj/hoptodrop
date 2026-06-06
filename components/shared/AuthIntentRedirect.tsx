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

function riderCallbackUrl(search: string, hash: string) {
  const params = new URLSearchParams(search);
  params.set("mode", "customer");
  params.set("method", params.get("method") || "google");
  params.set("next", "/rider/dashboard");
  return `/auth/callback?${params.toString()}${hash}`;
}

export default function AuthIntentRedirect() {
  useEffect(() => {
    async function recoverOauthReturn() {
      const intent = getAuthIntent();
      if (!intent || !isMainHost(window.location.hostname)) return;

      const hasOauthPayload =
        window.location.search.includes("code=") ||
        window.location.hash.includes("access_token=") ||
        window.location.hash.includes("refresh_token=");

      if (hasOauthPayload) {
        // fix: recover Google logins if Supabase returns to the Site URL root instead of the expected callback route.
        window.location.replace(
          intent === "driver"
            ? driverCallbackUrl(window.location.search, window.location.hash)
            : riderCallbackUrl(window.location.search, window.location.hash)
        );
        return;
      }

      const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
      if (data.session?.access_token && data.session.refresh_token) {
        const hash = `#access_token=${encodeURIComponent(data.session.access_token)}&refresh_token=${encodeURIComponent(data.session.refresh_token)}`;
        window.location.replace(intent === "driver" ? driverCallbackUrl("", hash) : riderCallbackUrl("", hash));
        return;
      }

      clearAuthIntent();
    }

    recoverOauthReturn();
  }, []);

  return null;
}
