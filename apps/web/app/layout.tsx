import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = { title: "Personal Agent — WhatsApp AI", description: "Tumhara khud ka WhatsApp AI assistant" };

export const viewport = { themeColor: "#070b10" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
