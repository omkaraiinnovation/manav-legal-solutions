import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT", "WONK"],
  display: "swap",
});
const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Manav Legal Solutions — Pan-India Paralegal OS",
  description: "AI-powered paralegal and legal-operations platform for Manav Legal Solutions, Patna, Bihar.",
};

/** Minimal root layout — deliberately has NO auth check and NO Sidebar. Both
 *  the /login (public) route and the (app) route group's own layout render
 *  under this. Putting getCurrentUser() here instead would make /login
 *  redirect to itself whenever signed out, since every route (including
 *  /login) renders through the root layout. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}>{children}</body>
    </html>
  );
}
