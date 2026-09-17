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
          50: "#FAF7F2",   // 香椰奶白 (底色/浅背景)
          100: "#F3EBE1",  // 椰乳微温 (轻度卡片底)
          200: "#E6D7C3",  // 椰肉米褐 (细微边框/分隔线)
          300: "#D4BEA3",  // 椰肉浅焙 (浅色图标/辅助)
          400: "#C2A88F",  // 调亮提升暗色模式对比度
          500: "#8C6746",  // 提升中度文本对比度
          600: "#6B4A2D",  // 浓郁烤椰壳 (主操作渐变起)
          700: "#52371E",  // 经典深焙椰壳 (主品牌/CTA强调)
          800: "#382312",  // 深浓椰褐 (主标题/文字深色)
          900: "#22140A",  // 浓缩原生态椰壳 (最深文字)
          950: "#140B05",  // 极深椰影
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
          canvas: "#0C0A09",   // 极致纯净深邃底色 (暗夜黑石，杜绝浑浊泥浆感)
          card: "#181512",     // 一级卡片面 (与底色有明显且舒适的阶梯分离)
          elevated: "#24201C", // 悬浮弹窗、下拉菜单、浮层
          subtle: "#1F1B17",   // 输入框底色、次级胶囊标签
          hover: "#2A241E",    // 悬停高亮
          border: "#383027",   // 高对比度精晰边框 (彻底解决暗黑边框隐形问题)
          borderLight: "#483E33",
          borderStrong: "#5E5143",
          text: "#FCFBFA",     // 暗色模式高亮主文字 (16:1 极致对比，清晰醒目)
          muted: "#B5ACA1",    // 暗色模式高保真辅助文字 (6.5:1+ WCAG AAA 对比度，清晰明亮，绝不发灰发乌)
          subtext: "#8A8074",  // 次要注释与占位说明 (4.5:1+ WCAG AA 对比度)
        },
      },
      boxShadow: {
        "coconut-sm": "0 2px 8px -1px rgba(66, 43, 25, 0.06)",
        "coconut-md": "0 8px 24px -4px rgba(66, 43, 25, 0.08)",
        "coconut-lg": "0 16px 40px -6px rgba(66, 43, 25, 0.12)",
        "coconut-glow": "0 0 20px -2px rgba(212, 163, 115, 0.25)",
        "3d-sunset": "0 4px 0 #C2410C, 0 8px 20px -2px rgba(234, 88, 12, 0.45)",
        "3d-sunset-hover": "0 6px 0 #C2410C, 0 12px 24px -2px rgba(234, 88, 12, 0.55)",
        "3d-sunset-active": "0 1px 0 #C2410C, 0 3px 8px rgba(234, 88, 12, 0.35)",
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
