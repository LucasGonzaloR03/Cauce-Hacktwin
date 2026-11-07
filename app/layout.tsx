import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Providers } from "@/app/providers";
import type { Theme } from "@/app/providers";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Cauce",
  title: "Cauce",
  description: "Tu dinero, a tu ritmo.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cauce", statusBarStyle: "default" },
};

export async function generateViewport(): Promise<Viewport> {
  const theme = (await cookies()).get("cauce_theme")?.value;
  return {
    themeColor: theme === "dark" ? "#111111" : "#ffffff",
    width: "device-width",
    initialScale: 1,
  };
}

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const savedTheme = (await cookies()).get("cauce_theme")?.value;
  const theme: Theme = savedTheme === "dark" ? "dark" : "light";

  return (
    <html lang="es-AR" data-theme={theme}>
      <body>
        <Providers initialTheme={theme}>{children}</Providers>
      </body>
    </html>
  );
}
