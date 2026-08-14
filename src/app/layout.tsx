import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { THEME_STORAGE_KEY } from "@/types";
import "@/styles/globals.css";

const andersonRegular = localFont({
  src: [
    {
      path: "../../public/fonts/AndersonGroteskRegular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/AndersonGroteskBold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-body",
  display: "swap",
});

const andersonUltrabold = localFont({
  src: "../../public/fonts/AndersonGroteskUltrabold.otf",
  variable: "--font-display",
  display: "swap",
  weight: "800",
});

export const metadata: Metadata = {
  title: "Pizza Calculator",
  description:
    "A precision pizza dough calculator with baker's math, temperature-aware yeast dosing, and poolish preferment support.",
  icons: {
    icon: [
      { url: "/favicon16x16.ico", sizes: "16x16", type: "image/x-icon" },
      { url: "/favicon32x32.ico", sizes: "32x32", type: "image/x-icon" },
      { url: "/favicon48x48.ico", sizes: "48x48", type: "image/x-icon" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#18181b" },
  ],
};

/*
 * The stored theme is client-only state, so the server cannot render it. This
 * runs synchronously while the HTML is parsed, before the first paint, which
 * stamps data-theme onto <html> without a flash and without a hydration error
 * (the attribute is not part of React's rendered output).
 */
const themeScript = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${andersonRegular.variable} ${andersonUltrabold.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-page text-text">
        {children}
      </body>
    </html>
  );
}
