import type { Metadata, Viewport } from "next";
import "./globals.css";
import { EVENT } from "@/lib/brand";

const title = "Frame in Goa — Hacker House Goa 2026 ID & PFP Generator";
const description =
  "Upload a photo and get an on-brand Hacker House Goa 2026 Builder ID card or profile-picture frame in seconds. Download the PNG and share it with #FrameInGoa.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title,
  description,
  applicationName: "Frame in Goa",
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  themeColor: "#0F5132",
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays enabled: the photo control handles its own gestures via
  // touch-action, and disabling page zoom outright is an accessibility failure.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/Imbue.woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          type="font/woff2"
          href="/fonts/YatraOne.woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {children}
        <footer className="border-t border-[var(--cream)]/10 py-8 text-center text-xs text-[var(--cream)]/45">
          <p className="font-display tracking-[0.2em] text-[var(--cream)]/60">
            {EVENT.studio}
          </p>
          <p className="mt-1">
            {EVENT.dates} · {EVENT.location} · {EVENT.url}
          </p>
        </footer>
      </body>
    </html>
  );
}
