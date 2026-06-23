import "./globals.css";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";

export const metadata = { title: "AGOCAP Content AI Hub" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it">
      <body>
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 p-6">
            <div className="mx-auto max-w-6xl">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
