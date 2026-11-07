import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Cauce",
  title: "Cauce",
  description: "Tu dinero, a tu ritmo.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cauce", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#f3ede3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es-AR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
