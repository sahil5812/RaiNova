import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import OceanSkyBackground from "@/components/OceanSkyBackground";
import { ScrollRevealInit } from "@/components/ScrollRevealInit";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RaiNova — Mumbai Urban Infrastructure Digital Twin",
  description: "Real-time AI/ML urban infrastructure disaster management twin for Mumbai.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/icon.png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${plusJakarta.className} ${plusJakarta.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} antialiased text-slate-100 min-h-screen relative overflow-x-hidden`}
      >
        {/* Global Scroll Reveal Animation Observer */}
        <ScrollRevealInit />

        {/* Full-Body Fixed Interactive Procedural WebGL Ocean & Sky Shader Background */}
        <OceanSkyBackground />

        <LanguageProvider>
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
