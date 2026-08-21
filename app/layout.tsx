import type { Metadata } from "next";
import { Fraunces, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { getCurrentUser } from "@/lib/session";

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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${publicSans.variable} ${plexMono.variable}`}>
        <div className="flex h-screen overflow-hidden">
          <Sidebar role={user.role} />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
