import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "XC_OmniBox (XC 万象箱) - 椰林质感全能在线工坊",
  description: "自然椰香美学 · 极简 · 高保真 · 300+ DPI 无损 · 零隐私泄漏的全能工坊",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#E8D5C4" },
    { media: "(prefers-color-scheme: dark)", color: "#1E1612" },
  ],
};

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
                    'system': 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Roboto, sans-serif',
                    'kaiti': 'KaiTi, "楷体", "STKaiti", "BiauKai", cursive, serif',
                    'serif': 'SimSun, "宋体", "STSong", "Songti SC", serif',
                    'fangsong': 'FangSong, "仿宋", "STFangsong", serif',
                    'heavy': 'SimHei, "黑体", "Arial Black", Impact, sans-serif',
                    'mono': '"Cascadia Code", Consolas, "Courier New", monospace'
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
        {children}
      </body>
    </html>
  );
}

