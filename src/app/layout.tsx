import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/company/ServiceWorkerRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "Career Company Tracker",
  description: "좋은 회사 후보를 평가하고 추적하는 개인용 웹앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <ServiceWorkerRegistration />
        <a
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-1 focus:text-sm focus:shadow"
          href="#main-content"
        >
          본문 바로가기
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
