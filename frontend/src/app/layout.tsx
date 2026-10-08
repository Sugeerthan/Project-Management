import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Portfolio Management", description: "Automated portfolio generation" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}

