"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, UserRound, X } from "lucide-react";
import { clearAccountMode, getAccountMode } from "@/lib/accountMode";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type SessionRole = "customer" | "driver" | "admin" | null;

function sessionRole(user: any, pathname: string): SessionRole {
  if (!user) return null;
  const role = user.user_metadata?.role;
  const accountMode = getAccountMode();
  if (role === "admin") return "admin";
  if (accountMode === "driver") return "driver";
  if (accountMode === "customer") return "customer";
  // fix: one account can act as driver or customer; the current app area decides the menu mode.
  if (pathname.startsWith("/driver")) return "driver";
  return "customer";
}

async function driverAccountPath(userId: string) {
  if (!supabase) return "/driver";

  const { data } = await supabase
    .from("driver_profiles")
    .select("approval_status")
    .eq("id", userId)
    .maybeSingle();

  return data?.approval_status === "approved" ? "/driver/dashboard" : "/driver/formaplication";
}

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<SessionRole>(null);
  const [email, setEmail] = useState("");
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      // fix: close the dropdown when the user clicks outside the top nav.
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    async function loadSession() {
      const { data } = await supabase!.auth.getSession();
      const user = data.session?.user;
      setRole(sessionRole(user, pathname));
      setEmail(user?.email || "");
    }

    loadSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setRole(sessionRole(user, pathname));
      setEmail(user?.email || "");
    });

    return () => data.subscription.unsubscribe();
  }, [pathname]);

  function goLiveMap() {
    setOpen(false);
    window.dispatchEvent(new Event("taxi-go-live-map"));
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearAccountMode();
    setOpen(false);
    setRole(null);
    setEmail("");
    router.replace("/");
  }

  async function openAccount() {
    setOpen(false);

    if (!isSupabaseConfigured || !supabase) {
      router.push("/customer-login");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (!user) {
      router.push("/customer-login");
      return;
    }

    const nextRole = sessionRole(user, pathname);
    if (nextRole === "admin") router.push("/admin");
    else if (nextRole === "driver") router.push(await driverAccountPath(user.id));
    else router.push("/client/dashboard");
  }

  return (
    <header className="top-nav" ref={navRef}>
      <Link href="/" className="logo" aria-label="Live map" onClick={goLiveMap}>
        <span>HopToDrop</span>
        <span>Albania</span>
      </Link>
      {pathname === "/" ? (
        <button className="menu-btn account-btn" aria-label={role ? "Open account" : "Log in"} onClick={openAccount}>
          <UserRound size={23} />
        </button>
      ) : (
        <button className="menu-btn" aria-label="Open menu" onClick={() => setOpen((value) => !value)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}
      {open && (
        <nav className="top-menu">
          {/* fix: hamburger becomes the main customer account menu when a rider is logged in. */}
          {role === "customer" && (
            <>
              <span className="menu-account">{email}</span>
              <Link href="/">Booking</Link>
              <Link href="/client/dashboard">Dashboard</Link>
              <button type="button" onClick={logout}>Log out</button>
            </>
          )}
          {role === "driver" && (
            <>
              <span className="menu-account">{email}</span>
              <Link href="/driver">Driver portal</Link>
              <button type="button" onClick={logout}>Log out</button>
            </>
          )}
          {role === "admin" && (
            <>
              <span className="menu-account">{email}</span>
              <Link href="/admin">Admin</Link>
              <Link href="/">Booking</Link>
              <button type="button" onClick={logout}>Log out</button>
            </>
          )}
          {!role && (
            <>
              <Link href="/">Booking</Link>
              <Link href="/customer-login">Customer Login</Link>
              <Link href="/driver">Driver Login</Link>
              <Link href="/admin">Admin</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
