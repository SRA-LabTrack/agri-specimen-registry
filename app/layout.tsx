import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import BrandSplash from "./brand-splash";
import ServiceWorkerRegister from "./service-worker-register";

export const metadata: Metadata = {
  title: { default: "AgriRegistry", template: "%s | AgriRegistry" },
  description: "A searchable agricultural biodiversity registry for specimen records, photographs, and verification history.",
  applicationName: "AgriRegistry",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/agriregistry-icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/agriregistry-icon.png",
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><ServiceWorkerRegister /><BrandSplash />{children}

        {/* AGRIREGISTRY_UI_ROLLBACK_V12_ASSETS */}
        <script
          src="/agriregistry-ui-cleanup-v12.js?v=12.1.0"
          defer
        ></script>
      </body></html>;
}