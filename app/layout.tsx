import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Comprehend - Language Reading Practice",
  description:
    "Improve your language skills with AI-powered reading comprehension exercises",
  keywords: "language learning, reading comprehension, CEFR, AI, education",
  authors: [{ name: "Comprehend Team" }],
  openGraph: {
    title: "Comprehend - AI-Powered Language Learning",
    description:
      "Practice reading comprehension in multiple languages with adaptive difficulty",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={poppins.className}>{children}</body>
    </html>
  );
}
