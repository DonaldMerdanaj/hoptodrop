"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

export default function TopNav() {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      // fix: close the dropdown when the user clicks outside the top nav.
      if (navRef.current && !navRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function goLiveMap() {
    setOpen(false);
    window.dispatchEvent(new Event("taxi-go-live-map"));
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
          {/* fix: hamburger now renders the requested route menu. */}
          <Link href="/">Booking</Link>
          <Link href="/customer-login">Customer Login</Link>
          <Link href="/driver/dashboard">Driver</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      )}
    </header>
  );
}
