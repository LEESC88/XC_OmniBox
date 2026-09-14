import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XC_OmniBox (XC 万象箱)",
  description: "极简 · 高保真 · 300+ DPI 无损 · 零隐私泄漏的全能在线工坊",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased selection:bg-blue-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
