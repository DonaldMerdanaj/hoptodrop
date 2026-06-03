"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, UserRound, X } from "lucide-react";
import { clearAccountMode } from "@/lib/accountMode";
import { getCurrentUserProfile } from "@/lib/authProfile";
import { driverDestination } from "@/lib/driverRouting";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type SessionRole = "customer" | "driver" | "admin" | null;

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<SessionRole>(null);
  const [email, setEmail] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
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
    setAuthChecked(false);
    if (!isSupabaseConfigured || !supabase) {
      setAuthChecked(true);
      return;
    }

    async function loadSession() {
      try {
        const { user, profile } = await getCurrentUserProfile();
        setRole((profile?.role as SessionRole) || null);
        setEmail(user?.email || "");
      } finally {
        setAuthChecked(true);
      }
    }

    loadSession();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadSession();
    });

    return () => data.subscription.unsubscribe();
  }, [pathname]);

  async function goLiveMap(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    setOpen(false);
    const { user, profile } = await getCurrentUserProfile();
    if (user && profile?.role === "driver") {
      router.push(await driverDestination(user.id));
      return;
    }
    if (user && profile?.role === "admin") {
      router.push("/admin");
      return;
    }
    router.push("/");
    window.dispatchEvent(new Event("taxi-go-live-map"));
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearAccountMode();
    setOpen(false);
    setRole(null);
    setEmail("");
    router.replace(pathname.startsWith("/driver") ? "/driver" : "/customer-login");
  }

  async function openAccount() {
    setOpen(false);

    if (!isSupabaseConfigured || !supabase) {
      router.push("/customer-login");
      return;
    }

    const { user, profile } = await getCurrentUserProfile();
    if (!user) {
      router.push("/customer-login");
      return;
    }

    const nextRole = (profile?.role as SessionRole) || null;
    if (nextRole === "admin") router.push("/admin");
    else if (nextRole === "driver") router.push(await driverDestination(user.id));
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
          {!role && email && (
            <>
              <span className="menu-account">{email}</span>
              <Link href="/">Booking</Link>
              <Link href="/client/dashboard">Dashboard</Link>
              <button type="button" onClick={logout}>Log out</button>
            </>
          )}
          {!role && !email && authChecked && (
            <>
              <Link href="/">Booking</Link>
              <Link href="/customer-login">Customer Login</Link>
              <Link href="/driver">Driver Login</Link>
            </>
          )}
          {!authChecked && <span className="menu-account">Checking account...</span>}
        </nav>
      )}
    </header>
  );
}
