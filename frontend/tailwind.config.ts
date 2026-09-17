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
          400: "#B99B7D",  // 椰丝焦香 (次级修饰)
          500: "#977453",  // 黄金烤椰 (次要按钮/微调)
          600: "#7A583A",  // 浓郁烤椰壳 (主操作渐变起)
          700: "#5C3E26",  // 经典深焙椰壳 (主品牌/CTA强调)
          800: "#422B19",  // 深浓椰褐 (主标题/文字深色)
          900: "#2B1B10",  // 浓缩原生态椰壳 (最深文字)
          950: "#170E08",  // 极深椰影
        },
        palm: {
          50: "#F1F8F4",   // 清椰水漾 (浅色状态背景)
          100: "#E0F2E7",  // 青椰嫩叶 (徽章背景)
          200: "#BEE3CD",  // 浅嫩棕榈
          300: "#8ECCAA",  // 青翠绿叶
          400: "#52B788",  // 鲜活青椰绿 (强调指示点)
          500: "#389F6F",  // 润泽椰林绿 (成功/主要状态)
          600: "#267B54",  // 葱郁深绿
          700: "#1E5E41",  // 浓密椰林
        },
        toast: {
          300: "#F5D5AE",
          400: "#EBBF8A",
          500: "#D4A373",  // 焦糖香烤 (夜间高亮主强调)
          600: "#BD8656",
          700: "#A16B3C",
        },
        darkbg: {
          canvas: "#130F0C",   // 深焙夜幕底色
          card: "#1D1713",     // 深椰木卡片
          elevated: "#271F19", // 悬浮弹窗与层叠区
          border: "#382D24",   // 深夜椰壳边框
          borderLight: "#473B30",
        },
      },
      boxShadow: {
        "coconut-sm": "0 2px 8px -1px rgba(66, 43, 25, 0.06)",
        "coconut-md": "0 8px 24px -4px rgba(66, 43, 25, 0.08)",
        "coconut-lg": "0 16px 40px -6px rgba(66, 43, 25, 0.12)",
        "coconut-glow": "0 0 20px -2px rgba(212, 163, 115, 0.25)",
      },
      animation: {
        "pulse-subtle": "pulseSubtle 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        pulseSubtle: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
