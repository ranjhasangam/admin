import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: {
    default: "SD Digital Hub — Admin Panel",
    template: "%s · SD Digital Hub Admin",
  },
  description:
    "Private administration panel for SD Digital Hub — requests, sessions, analytics, security and website settings. Authorized administrators only.",
  robots: { index: false, follow: false, nocache: true },
  applicationName: "SD Digital Hub Admin Panel",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
