import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { AuthHydrator } from "@/components/AuthHydrator";
import { FloatingUserMenu } from "@/components/FloatingUserMenu";
import { ThemeProvider } from "@/lib/theme-context";

export const metadata: Metadata = {
  title: "Q-Chess",
  description: "Play chess with advanced game tracking and analysis",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistSans.className}`}
      suppressHydrationWarning
    >
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthHydrator />
          <div className="min-h-screen flex flex-col">
            <FloatingUserMenu />
            <main className="flex-1">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
