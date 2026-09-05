import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Account 360 | Finance Operating System",
  description: "ระบบบัญชี การเงิน ภาษี งบประมาณ และการปิดงวดแบบรวมศูนย์",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/kc-account-360-app-logo.png",
    shortcut: "/kc-account-360-app-logo.png",
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
