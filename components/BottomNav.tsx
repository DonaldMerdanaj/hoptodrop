"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarCheck, Car, UserRound } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const items = [
  { href: "/driver/dashboard", label: "Driver", icon: Car },
  { href: "/customer-login", label: "Customer Login", icon: UserRound },
  { href: "/", label: "Booking", icon: CalendarCheck }
];

export default function BottomNav() {
  const pathname = usePathname();
  const [hideForSignedInUser, setHideForSignedInUser] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    async function loadSession() {
      const { data } = await supabase!.auth.getSession();
      const user = data.session?.user;
      setHideForSignedInUser(Boolean(user));
    }

    loadSession();
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setHideForSignedInUser(Boolean(session?.user));
    });

    return () => data.subscription.unsubscribe();
  }, []);

  if (hideForSignedInUser) {
    // fix: logged-in customers and drivers use the hamburger account menu, so the bottom nav is hidden.
    return <span className="customer-session-marker" aria-hidden="true" />;
  }

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (item.href === "/driver/dashboard" && pathname.startsWith("/driver"));
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : ""}>
            <Icon size={17} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
