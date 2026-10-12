import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한걸음 · 운동 다이어리",
  description: "계획하고, 움직이고, 돌아보는 나의 운동 기록",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
