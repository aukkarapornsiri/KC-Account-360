import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Account 360 | Finance Operating System",
  description: "ระบบบัญชี การเงิน ภาษี งบประมาณ และการปิดงวดแบบรวมศูนย์",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/api/branding/logo",
    shortcut: "/api/branding/logo",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
