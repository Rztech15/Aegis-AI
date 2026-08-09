export const metadata = {
  title: "Aegis AI — Safe Communication. Smart Protection.",
  description: "A messaging platform with a built-in AI safety layer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "Arial, sans-serif", background: "#0A0F0D" }}>{children}</body>
    </html>
  );
}
