import type { Metadata } from "next";
import { Toaster } from "sonner";
import { PortalShell } from "@/components/portal-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ServeLink — Tupi, South Cotabato", template: "%s | ServeLink" },
  description: "A better connection between the people of Tupi and their local government.",
  icons: { icon: "/municipal_design_download.svg", apple: "/municipal_design_download.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <PortalShell>{children}</PortalShell>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
