import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coconut: {
          50: "#FAF1E8",   // 润泽暖肤色微白 (高光卡片)
          100: "#F3E5D7",  // 柔暖生肤微温 (轻度卡片底)
          200: "#E8D5C4",  // 生椰润肤底色 (微白温暖带彩)
          300: "#D2BCAB",  // 清晰暖焙肤色边框线 (清晰不粗糙)
          400: "#7A4D2E",  // 调深提升浅色模式对比度
          500: "#54321B",  // 深度高对比文本
          600: "#3A2010",  // 浓郁深木
          700: "#241308",  // 经典深焙椰壳
          800: "#180B04",  // 深浓椰褐 (主标题/文字深色)
          900: "#0F0602",  // 浓缩原生态椰壳
          950: "#080301",  // 极深高对比
        },
        palm: {
          50: "#F1F8F4",   // 清椰水漾 (浅色状态背景)
          100: "#E0F2E7",  // 青椰嫩叶 (徽章背景)
          200: "#BEE3CD",  // 浅嫩棕榈
          300: "#8ECCAA",  // 青翠绿叶
          400: "#4ADE80",  // 鲜活青椰绿 (强调指示点，深色模式高对比)
          500: "#22C55E",  // 润泽椰林绿 (成功/主要状态)
          600: "#16A34A",  // 葱郁深绿
          700: "#15803D",  // 浓密椰林
          800: "#166534",
          900: "#14532D",
          950: "#052E16",
        },
        toast: {
          300: "#FDE68A",
          400: "#FBBF24",
          500: "#F59E0B",  // 金黄高亮
          600: "#D97706",
          700: "#B45309",
        },
        darkbg: {
          canvas: "#1A1411",   // 深焙椰炭暖木色基底 (告别死黑，富有温度与质感)
          card: "#251E1A",     // 熟烤椰壳卡片面 (层级分明，温润醇厚)
          elevated: "#2F2520", // 悬浮弹窗、下拉菜单、浮层
          subtle: "#201815",   // 输入框底色、次级胶囊标签
          hover: "#342A24",    // 悬停高亮
          border: "#44342A",   // 清晰分明的暗色椰壳轮廓线 (线条分明绝不模糊)
          borderLight: "#544237",
          borderStrong: "#6E5749",
          text: "#FFFFFF",     // 纯净雪白主字色 (极致清晰高对比)
          muted: "#E8DDD3",    // 暖调高保真辅助文字 (显著增亮，高对比清晰易读)
          subtext: "#D0C0B2",  // 次要注释与占位说明 (清晰明了)
        },
      },
      boxShadow: {
        "coconut-sm": "0 2px 8px -1px rgba(66, 43, 25, 0.06)",
        "coconut-md": "0 8px 24px -4px rgba(66, 43, 25, 0.08)",
        "coconut-lg": "0 16px 40px -6px rgba(66, 43, 25, 0.12)",
        "coconut-glow": "0 0 20px -2px rgba(212, 163, 115, 0.25)",
        "3d-sunset": "0 4px 0 rgba(0, 0, 0, 0.35), 0 8px 20px -2px var(--color-accent-shadow, rgba(234, 88, 12, 0.45))",
        "3d-sunset-hover": "0 6px 0 rgba(0, 0, 0, 0.35), 0 12px 24px -2px var(--color-accent-shadow, rgba(234, 88, 12, 0.55))",
        "3d-sunset-active": "0 1px 0 rgba(0, 0, 0, 0.35), 0 3px 8px var(--color-accent-shadow, rgba(234, 88, 12, 0.35))",
        "3d-secondary": "0 3px 0 #D4BEA3, 0 6px 12px -2px rgba(66, 43, 25, 0.08)",
        "3d-secondary-dark": "0 3px 0 #2A241E, 0 6px 12px -2px rgba(0, 0, 0, 0.35)",
      },
      animation: {
        "pulse-subtle": "pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "stripes": "moveStripes 1s linear infinite",
        "shimmer": "shimmer 2.5s ease-in-out infinite",
      },
      keyframes: {
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
        moveStripes: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "32px 0" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
