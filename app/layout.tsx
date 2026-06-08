import type { Metadata, Viewport } from "next";
import AuthIntentRedirect from "@/components/shared/AuthIntentRedirect";
import PwaRegister from "@/components/shared/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HopToDrop | Taxi Rides in Albania",
    template: "%s | HopToDrop"
  },
  description: "Book live taxi rides and airport transfers across Albania with HopToDrop.",
  applicationName: "HopToDrop",
  keywords: [
    "HopToDrop",
    "Albania taxi app",
    "Tirana taxi",
    "Tirana airport transfer",
    "airport taxi Albania",
    "taxi Vlora",
    "taxi Durres"
  ],
  creator: "HopToDrop",
  publisher: "HopToDrop",
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
    title: "HopToDrop | Taxi Rides in Albania",
    description: "Book live taxi rides and airport transfers across Albania.",
    url: "https://www.hoptodrop.com",
    siteName: "HopToDrop",
    locale: "en_US",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "HopToDrop | Taxi Rides in Albania",
    description: "Book live taxi rides and airport transfers across Albania."
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1
    }
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
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://www.hoptodrop.com/#organization",
        name: "HopToDrop",
        url: "https://www.hoptodrop.com",
        logo: "https://www.hoptodrop.com/icon.svg"
      },
      {
        "@type": "WebApplication",
        "@id": "https://www.hoptodrop.com/#app",
        name: "HopToDrop",
        applicationCategory: "TravelApplication",
        operatingSystem: "iOS, Android, Web",
        url: "https://www.hoptodrop.com",
        description: "Mobile web app for booking live taxi rides and airport transfers in Albania.",
        offers: {
          "@type": "Offer",
          priceCurrency: "EUR"
        },
        publisher: {
          "@id": "https://www.hoptodrop.com/#organization"
        }
      }
    ]
  };

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <div className="desktop-blocker" aria-live="polite">
          <h1>Open HopToDrop on mobile</h1>
          <p>This ride booking app is designed for phones only. Please open hoptodrop.com from your mobile device.</p>
        </div>
        <AuthIntentRedirect />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
