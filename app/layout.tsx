import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegister from "./service-worker-register";

export const metadata: Metadata = {
  title: "AgriSpecimen Registry",
  description: "Agricultural specimen records, taxonomy, photographs, and verification history.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><ServiceWorkerRegister />{children}</body>
    </html>
  );
}
