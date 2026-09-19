import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import { siteDescription, siteName, siteUrl } from "../lib/site";
import { Providers } from "./providers";
import "./globals.css";

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});
const displayFont = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  applicationName: siteName,
  title: {
    default: `${siteName} - GitHub repository activity dashboard`,
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "GitHub dashboard",
    "repository activity",
    "issue tracking",
    "pull request tracking",
    "developer workflow",
    "GitHub App",
  ],
  authors: [{ name: "Plinger" }],
  creator: "Plinger",
  publisher: "Plinger",
  alternates: {
    canonical: "/",
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    url: "/",
    siteName,
    title: `${siteName} - GitHub repository activity dashboard`,
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${siteName} dashboard preview`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} - GitHub repository activity dashboard`,
    description: siteDescription,
    images: [
      {
        url: "/twitter-image",
        alt: `${siteName} dashboard preview`,
      },
    ],
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
