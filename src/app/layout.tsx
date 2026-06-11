import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Company Tracker",
  description: "좋은 회사 후보를 평가하고 추적하는 개인용 웹앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
