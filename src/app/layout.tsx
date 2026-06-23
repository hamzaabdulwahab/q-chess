import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { cookies } from "next/headers";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { FloatingUserMenu } from "@/components/FloatingUserMenu";
import { SettingsProvider } from "@/lib/settings-context";
import { ThemeProvider } from "@/lib/theme-context";
import {
  DEFAULT_THEME_ID,
  GLOBAL_THEME_KEY,
  GLOBAL_THEME_USER_SET_KEY,
  isValidThemeId,
  themeVarsCss,
} from "@/lib/themes";

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

// Read-only pre-paint reconciliation. The server already set data-chess-theme
// from the cookie (below); if THIS browser has an explicit localStorage choice
// (e.g. set before cookies were wired up, or its cookie was cleared) prefer it
// so the attribute matches what the client will render. No writes — seeding the
// default is now the server's job, removing the previous render-time side effect.
const themeBootScript = `
(() => {
  try {
    var saved = window.localStorage.getItem("${GLOBAL_THEME_KEY}");
    var userSet = window.localStorage.getItem("${GLOBAL_THEME_USER_SET_KEY}") === "true";
    if (userSet && saved) {
      document.documentElement.dataset.chessTheme = saved;
    }
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolve the board theme on the server from the persisted cookie so the
  // correct colors are present on <html> before the first paint (true
  // zero-flicker); fall back to Forest Green for first-time visitors.
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get(GLOBAL_THEME_KEY)?.value;
  const initialTheme = isValidThemeId(cookieTheme)
    ? (cookieTheme as string)
    : DEFAULT_THEME_ID;

  return (
    <html
      lang="en"
      data-chess-theme={initialTheme}
      className={`${GeistSans.variable} ${GeistSans.className}`}
      suppressHydrationWarning
    >
      <head>
        <style
          id="chess-theme-vars"
          dangerouslySetInnerHTML={{ __html: themeVarsCss() }}
        />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <SettingsProvider>
          <ThemeProvider>
            <AuthProvider>
              <div className="min-h-screen flex flex-col">
                <FloatingUserMenu />
                <main className="flex-1">{children}</main>
              </div>
            </AuthProvider>
          </ThemeProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
