import "./globals.css";
import type { ReactNode } from "react";
import { Nav } from "@/components/nav";
export const metadata = { title: "AGOCAP Content AI Hub — Brain" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <Nav />
        <main className="mx-auto max-w-6xl p-6">{children}</main>
      </body>
    </html>
  );
}
