import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XC_OmniBox (XC 万象箱)",
  description: "本地多功能工具箱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F3EE" },
    { media: "(prefers-color-scheme: dark)", color: "#131110" },
  ],
};

import { I18nProvider } from "@/lib/i18n";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const savedTheme = localStorage.getItem('xc_theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                const savedCustom = localStorage.getItem('xc_custom_theme');
                if (savedCustom) {
                  const t = JSON.parse(savedCustom);
                  const root = document.documentElement;
                  if (t.background) root.style.setProperty('--color-canvas', t.background);
                  if (t.foreground) root.style.setProperty('--color-card', t.foreground);
                  if (t.border) root.style.setProperty('--color-border', t.border);
                  if (t.textMain) root.style.setProperty('--color-text-main', t.textMain);
                  if (t.textMuted) root.style.setProperty('--color-text-muted', t.textMuted);
                  if (t.accent) {
                    root.style.setProperty('--color-accent', t.accent);
                    let cHex = t.accent.replace('#', '').trim();
                    if (cHex.length === 3) cHex = cHex.split('').map(function(c) { return c + c; }).join('');
                    const num = parseInt(cHex, 16);
                    if (!isNaN(num)) {
                      const r = (num >> 16) & 255;
                      const g = (num >> 8) & 255;
                      const b = num & 255;
                      const lr = Math.min(255, r + 56);
                      const lg = Math.min(255, g + 56);
                      const lb = Math.min(255, b + 56);
                      const dr = Math.max(0, r - 51);
                      const dg = Math.max(0, g - 51);
                      const db = Math.max(0, b - 51);
                      const lHex = '#' + ((lr << 16) | (lg << 8) | lb).toString(16).padStart(6, '0');
                      const dHex = '#' + ((dr << 16) | (dg << 8) | db).toString(16).padStart(6, '0');
                      root.style.setProperty('--color-accent-gradient', 'linear-gradient(135deg, ' + lHex + ' 0%, ' + t.accent + ' 50%, ' + dHex + ' 100%)');
                      root.style.setProperty('--color-accent-shadow', 'rgba(' + r + ',' + g + ',' + b + ',0.42)');
                      root.style.setProperty('--color-accent-subtle', 'rgba(' + r + ',' + g + ',' + b + ',0.15)');
                      root.style.setProperty('--color-accent-border', 'rgba(' + r + ',' + g + ',' + b + ',0.35)');
                    }
                  }
                }
                const savedFont = localStorage.getItem('xc_custom_font');
                if (savedFont) {
                  const fontMap = {
                    'system': '"Segoe UI", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, sans-serif',
                    'inter': '"Century Gothic", "Trebuchet MS", "DengXian", "等线", "PingFang SC", "Microsoft JhengHei UI", sans-serif',
                    'roboto': 'Georgia, "Cambria", "Times New Roman", "STZhongsong", "华文中宋", "Songti SC", "SimSun", "宋体", serif',
                    'segoe': '"Palatino Linotype", "Book Antiqua", "STKaiti", "华文楷体", "KaiTi", "楷体", "Kaiti SC", serif',
                    'rounded': 'Verdana, "Trebuchet MS", "YouYuan", "幼圆", "STYuanti", "Microsoft YaHei UI", sans-serif',
                    'mono': '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", "NSimSun", "新宋体", monospace'
                  };
                  if (fontMap[savedFont]) {
                    document.documentElement.style.setProperty('--font-family', fontMap[savedFont]);
                    document.documentElement.style.fontFamily = fontMap[savedFont];
                  }
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="subpixel-antialiased selection:bg-toast-500/30 selection:text-coconut-950 dark:selection:bg-toast-500/35 dark:selection:text-coconut-50">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
