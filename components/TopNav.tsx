"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type SessionRole = "customer" | "driver" | "admin" | null;

export default function TopNav() {
  const router = useRouter();
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
      setRole((user?.user_metadata?.role as SessionRole) || null);
      setEmail(user?.email || "");
    }

    loadSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;
      setRole((user?.user_metadata?.role as SessionRole) || null);
      setEmail(user?.email || "");
    });

    return () => data.subscription.unsubscribe();
  }, []);

  function goLiveMap() {
    setOpen(false);
    window.dispatchEvent(new Event("taxi-go-live-map"));
  }

  async function logout() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setOpen(false);
    setRole(null);
    setEmail("");
    router.replace("/");
  }

  return (
    <header className="top-nav" ref={navRef}>
      <Link href="/" className="logo" aria-label="Live map" onClick={goLiveMap}>
        <span>HopToDrop</span>
        <span>Albania</span>
      </Link>
      <button className="menu-btn" aria-label="Open menu" onClick={() => setOpen((value) => !value)}>
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>
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
              <Link href="/driver/dashboard">Driver dashboard</Link>
              <Link href="/">Booking map</Link>
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
              <Link href="/driver-login">Driver Login</Link>
              <Link href="/admin">Admin</Link>
            </>
          )}
        </nav>
      )}
    </header>
  );
}
