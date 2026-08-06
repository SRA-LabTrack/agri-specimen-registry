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


        {/* AGRIREGISTRY_STABILITY_V11_7_ASSETS */}
        <link
          rel="stylesheet"
          href="/agriregistry-ui-v10.css?v=11.7.0"
        />
        <script
          src="/agriregistry-recovery-v11-7.js?v=11.7.0"
          defer
        ></script>
        <script
          src="/agriregistry-ui-v10.js?v=11.7.0"
          defer
        ></script>
      </body></html>;
}