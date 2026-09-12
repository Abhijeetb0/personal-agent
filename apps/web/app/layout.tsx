export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hi">
      <body style={{ fontFamily: "system-ui", margin: 0, background: "#0b0f14", color: "#e8eef4" }}>
        {children}
      </body>
    </html>
  );
}
