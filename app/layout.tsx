import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "Saveo — Save the file. Nothing in between.",
  description:
    "Paste a direct video or audio link and save it straight to your device. No server, no account, no tracking — the file never leaves your browser.",
  applicationName: "Saveo",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    title: "Saveo — Save the file. Nothing in between.",
    description: "Paste a direct link, save the file. No server, no account, no tracking.",
    type: "website",
    siteName: "Saveo",
  },
  twitter: {
    card: "summary",
    title: "Saveo — Save the file. Nothing in between.",
    description: "Paste a direct link, save the file. No server, no account, no tracking.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2efe8" },
    { media: "(prefers-color-scheme: dark)", color: "#12110e" },
  ],
};

/* Applied before first paint so the saved theme never flashes. */
const themeBootstrap = `(function(){try{var t=localStorage.getItem("saveo-theme");document.documentElement.dataset.theme=t==="dark"?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}})()`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        {children}
      </body>
    </html>
  );
}
