import "./globals.css";

export const metadata = { title: "Personal Agent — WhatsApp AI", description: "Tumhara khud ka WhatsApp AI assistant" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body>{children}</body>
    </html>
  );
}
