import type { Metadata, Viewport } from "next";
import PwaRegister from "@/components/shared/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "HopToDrop | Live Rides in Albania",
  description: "HopToDrop is an Albania-only live taxi and ride-hailing platform for riders, drivers, and dispatch.",
  applicationName: "HopToDrop",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL("https://www.hoptodrop.com"),
  alternates: {
    canonical: "https://www.hoptodrop.com"
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  },
  openGraph: {
    title: "HopToDrop",
    description: "Live on-demand rides across Albania.",
    url: "https://www.hoptodrop.com",
    siteName: "HopToDrop",
    type: "website"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "HopToDrop"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#111827"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="desktop-blocker" aria-live="polite">
          <h1>Open HopToDrop on mobile</h1>
          <p>This ride booking app is designed for phones only. Please open hoptodrop.com from your mobile device.</p>
        </div>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
