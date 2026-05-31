import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HopToDrop | Live Rides in Albania",
  description: "HopToDrop is an Albania-only live taxi and ride-hailing platform for riders, drivers, and dispatch.",
  metadataBase: new URL("https://www.hoptodrop.com"),
  alternates: {
    canonical: "https://www.hoptodrop.com"
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
  themeColor: "#ffffff"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="desktop-blocker" aria-live="polite">
          <h1>Open HopToDrop on mobile</h1>
          <p>This ride booking app is designed for phones only. Please open hoptodrop.vercel.app from your mobile device.</p>
        </div>
        {children}
      </body>
    </html>
  );
}
