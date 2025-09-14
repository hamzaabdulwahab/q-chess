import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthHydrator } from "@/components/AuthHydrator";
import { FloatingUserMenu } from "@/components/FloatingUserMenu";

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "For My Queen - Chess Game",
  description: "Play chess with advanced game tracking and analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${poppins.variable} ${geistMono.variable} antialiased`}>
        <AuthHydrator />
        <div className="min-h-screen flex flex-col">
          <FloatingUserMenu />
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
