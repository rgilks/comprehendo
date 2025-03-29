import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import AuthProvider from "./AuthProvider";
import ClientPWAWrapper from "./components/ClientPWAWrapper";

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#000000",
};

export const metadata: Metadata = {
  title: "Comprehend - Language Reading Practice",
  description:
    "Improve your language skills with AI-powered reading comprehension exercises",
  keywords: "language learning, reading comprehension, CEFR, AI, education",
  authors: [{ name: "Comprehend Team" }],
  metadataBase: new URL("http://localhost:3000"),
  openGraph: {
    title: "Comprehend - AI-Powered Language Learning",
    description:
      "Practice reading comprehension in multiple languages with adaptive difficulty",
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Comprehend",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className={poppins.className}>
        <AuthProvider>{children}</AuthProvider>
        <ClientPWAWrapper />
      </body>
    </html>
  );
}
