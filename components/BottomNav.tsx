"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, Car, UserRound } from "lucide-react";

const items = [
  { href: "/driver-login", label: "Driver", icon: Car },
  { href: "/customer-login", label: "Customer", icon: UserRound },
  { href: "/", label: "Booking", icon: CalendarCheck }
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href === "/driver-login" && pathname.startsWith("/driver")) ||
          (item.href === "/customer-login" && pathname.startsWith("/client"));
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
