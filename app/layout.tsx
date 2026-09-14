import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Plinger",
  description: "Repository signals for GitHub issues, pull requests, and merges.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
