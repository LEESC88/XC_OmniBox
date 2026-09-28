/**
 * 全局自定义调色系统与主题/字体预设管理器 (Theme, Color & Typography Manager)
 */

export interface CustomThemeConfig {
  id: string;
  name: string;
  nameEn?: string;
  background: string; // 窗口背景主底色 (Canvas / Window Background)
  foreground: string; // 面板与卡片底色 (Surface / Panel / Card)
  accent: string;     // 核心强调色 (Primary Accent for buttons & highlights)
  textMain: string;   // 正文主文字颜色 (Main Text - 高对比清晰)
  textMuted: string;  // 辅助说明文字颜色 (Muted Text - 深度可读)
  border: string;     // 轮廓线条边框色 (Border)
  isDark: boolean;    // 是否为暗色基调
}

export interface FontOption {
  id: string;
  name: string;
  nameEn?: string;
  badge: string;
  badgeEn?: string;
  desc: string;
  descEn?: string;
  sample: string;
  sampleEn?: string;
  fontFamily: string;
}

// 纯粹、高对比、现代专业的纯白 (White) 与极简深黑 (Dark) 主题
export const DEFAULT_WHITE_THEME: CustomThemeConfig = {
  id: "white",
  name: "极简白 (White)",
  nameEn: "Clean White",
  background: "#F8FAFC",
  foreground: "#FFFFFF",
  accent: "#2563EB",
  textMain: "#0F172A",
  textMuted: "#64748B",
  border: "#E2E8F0",
  isDark: false,
};

export const DEFAULT_DARK_THEME: CustomThemeConfig = {
  id: "dark",
  name: "极简黑 (Dark)",
  nameEn: "Minimal Dark",
  background: "#0F172A",
  foreground: "#1E293B",
  accent: "#3B82F6",
  textMain: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "#334155",
  isDark: true,
};

export const THEME_PRESETS: CustomThemeConfig[] = [
  DEFAULT_WHITE_THEME,
  DEFAULT_DARK_THEME,
];

// 常用正规标准英文字体体系 (杜绝奇形怪状的毛笔与仿宋字体，统一规范屏显)
export const FONT_PRESETS: FontOption[] = [
  {
    id: "system",
    name: "System Default / 系统默认",
    nameEn: "System Default",
    badge: "Default",
    badgeEn: "Default",
    desc: "System UI native standard font",
    descEn: "System UI native standard font",
    sample: "The quick brown fox jumps over the lazy dog 1234567890",
    sampleEn: "The quick brown fox jumps over the lazy dog 1234567890",
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  {
    id: "inter",
    name: "Inter / Modern Sans",
    nameEn: "Inter / Modern Sans",
    badge: "Modern",
    badgeEn: "Modern",
    desc: "Clean geometric sans-serif for UI clarity",
    descEn: "Clean geometric sans-serif for UI clarity",
    sample: "The quick brown fox jumps over the lazy dog 1234567890",
    sampleEn: "The quick brown fox jumps over the lazy dog 1234567890",
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  {
    id: "roboto",
    name: "Roboto / Clean",
    nameEn: "Roboto / Clean",
    badge: "Readable",
    badgeEn: "Readable",
    desc: "High legibility grotesque sans-serif",
    descEn: "High legibility grotesque sans-serif",
    sample: "The quick brown fox jumps over the lazy dog 1234567890",
    sampleEn: "The quick brown fox jumps over the lazy dog 1234567890",
    fontFamily: '"Roboto", "Segoe UI", Arial, sans-serif',
  },
  {
    id: "segoe",
    name: "Segoe UI / Windows",
    nameEn: "Segoe UI / Windows",
    badge: "Windows",
    badgeEn: "Windows",
    desc: "Windows official clear desktop font",
    descEn: "Windows official clear desktop font",
    sample: "The quick brown fox jumps over the lazy dog 1234567890",
    sampleEn: "The quick brown fox jumps over the lazy dog 1234567890",
    fontFamily: '"Segoe UI", -apple-system, Arial, sans-serif',
  },
  {
    id: "mono",
    name: "Monospace / Code",
    nameEn: "Monospace / Code",
    badge: "Monospace",
    badgeEn: "Monospace",
    desc: "Strict fixed-width characters for digits and data",
    descEn: "Strict fixed-width characters for digits and data",
    sample: "The quick brown fox jumps over the lazy dog 1234567890",
    sampleEn: "The quick brown fox jumps over the lazy dog 1234567890",
    fontFamily: '"Cascadia Code", "JetBrains Mono", Consolas, "Courier New", monospace',
  },
];

// 颜色转换与亮度调节工具函数
export function adjustHex(hex: string, percent: number): string {
  try {
    let cleanHex = hex.replace("#", "").trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split("").map((c) => c + c).join("");
    }
    let num = parseInt(cleanHex, 16);
    if (isNaN(num)) return hex;
    let r = ((num >> 16) & 255) + Math.round((255 * percent) / 100);
    let g = ((num >> 8) & 255) + Math.round((255 * percent) / 100);
    let b = (num & 255) + Math.round((255 * percent) / 100);
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  } catch {
    return hex;
  }
}

export function hexToRgba(hex: string, alpha: number): string {
  try {
    let cleanHex = hex.replace("#", "").trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split("").map((c) => c + c).join("");
    }
    let num = parseInt(cleanHex, 16);
    if (isNaN(num)) return `rgba(234, 88, 12, ${alpha})`;
    let r = (num >> 16) & 255;
    let g = (num >> 8) & 255;
    let b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return `rgba(234, 88, 12, ${alpha})`;
  }
}

/**
 * 纯样式预览：将主题调色注入全局 CSS Custom Properties (不写入持久化存储)
 */
export function previewTheme(theme: CustomThemeConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  // 1. 核心 CSS 变量无缝注入
  root.style.setProperty("--color-canvas", theme.background);
  root.style.setProperty("--color-card", theme.foreground);
  root.style.setProperty("--color-border", theme.border);
  root.style.setProperty("--color-text-main", theme.textMain);
  root.style.setProperty("--color-text-muted", theme.textMuted);
  root.style.setProperty("--color-accent", theme.accent);

  // 2. 动态生成配套渐变与立体阴影及高光描边
  const accentLight = adjustHex(theme.accent, 22);
  const accentDark = adjustHex(theme.accent, -20);
  const accentGradient = `linear-gradient(135deg, ${accentLight} 0%, ${theme.accent} 50%, ${accentDark} 100%)`;
  const accentShadow = hexToRgba(theme.accent, 0.42);
  const accentSubtle = hexToRgba(theme.accent, 0.15);
  const accentBorder = hexToRgba(theme.accent, 0.35);

  root.style.setProperty("--color-accent-gradient", accentGradient);
  root.style.setProperty("--color-accent-shadow", accentShadow);
  root.style.setProperty("--color-accent-subtle", accentSubtle);
  root.style.setProperty("--color-accent-border", accentBorder);
  root.style.setProperty("--color-card-elevated", adjustHex(theme.foreground, theme.isDark ? 8 : 4));

  // 3. 动态注入半透明面板与侧边栏底色
  root.style.setProperty("--color-panel-bg", hexToRgba(theme.foreground, theme.isDark ? 0.94 : 0.90));
  root.style.setProperty("--color-sidebar-bg", hexToRgba(theme.background, 0.97));

  // 4. 同步 HTML .dark 类，确保深浅基调无缝互通
  if (theme.isDark) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

/**
 * 实时将主题调色注入全局 CSS Custom Properties 并持久化保存
 */
export function applyCustomTheme(theme: CustomThemeConfig) {
  previewTheme(theme);

  // 5. 本地缓存当前生效主题配置与深浅专属配置
  try {
    localStorage.setItem("xc_custom_theme", JSON.stringify(theme));
    localStorage.setItem("xc_theme", theme.isDark ? "dark" : "light");
    if (theme.isDark) {
      localStorage.setItem("xc_custom_dark_theme", JSON.stringify(theme));
    } else {
      localStorage.setItem("xc_custom_white_theme", JSON.stringify(theme));
    }
  } catch (_) {}
}

/**
 * 获取浅色 (White) 模式已保存主题
 */
export function getSavedWhiteTheme(): CustomThemeConfig {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("xc_custom_white_theme");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
  }
  return DEFAULT_WHITE_THEME;
}

/**
 * 获取深色 (Dark) 模式已保存主题
 */
export function getSavedDarkTheme(): CustomThemeConfig {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("xc_custom_dark_theme");
      if (saved) return JSON.parse(saved);
    } catch (_) {}
  }
  return DEFAULT_DARK_THEME;
}

export function saveWhiteTheme(theme: CustomThemeConfig) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("xc_custom_white_theme", JSON.stringify({ ...theme, isDark: false }));
    } catch (_) {}
  }
}

export function saveDarkTheme(theme: CustomThemeConfig) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("xc_custom_dark_theme", JSON.stringify({ ...theme, isDark: true }));
    } catch (_) {}
  }
}

export function previewFont(fontId: string) {
  if (typeof document === "undefined") return;
  const font = FONT_PRESETS.find((f) => f.id === fontId) || FONT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty("--font-family", font.fontFamily);
  root.style.fontFamily = font.fontFamily;
  if (document.body) {
    document.body.style.fontFamily = font.fontFamily;
  }
}

export function applyCustomFont(fontId: string) {
  previewFont(fontId);
  try {
    localStorage.setItem("xc_custom_font", fontId);
  } catch (_) {}
}

/**
 * 从本地或持久层获取已保存的主题
 */
export function getSavedTheme(): CustomThemeConfig {
  if (typeof window !== "undefined") {
    try {
      const isDark = document.documentElement.classList.contains("dark") || localStorage.getItem("xc_theme") === "dark";
      const saved = localStorage.getItem("xc_custom_theme");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Boolean(parsed.isDark) === isDark) {
          return parsed;
        }
      }
      return isDark ? getSavedDarkTheme() : getSavedWhiteTheme();
    } catch (_) {}
  }
  return DEFAULT_WHITE_THEME;
}

/**
 * 获取已保存的字体
 */
export function getSavedFont(): string {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("xc_custom_font");
      if (saved) return saved;
    } catch (_) {}
  }
  return "system";
}

export interface CatPawOption {
  id: string;
  name: string;
  nameEn?: string;
  tag: string;
  tagEn?: string;
  desc: string;
  descEn?: string;
  src: string;
  thumb: string;
}

// 4 款真实精致萌宠猫肉球形象 (assets/cat_paws)
export const CAT_PAW_PRESETS: CatPawOption[] = [
  {
    id: "3_calico_pink",
    name: "三花粉嫩肉球",
    nameEn: "Calico Pink Paw",
    tag: "默认精选",
    tagEn: "Default",
    desc: "甜美三花软糖粉肉垫，晶莹通透高反光，萌力十足",
    descEn: "Sweet jelly pink cat paw with glossy highlights",
    src: "/cat_paws/3_calico_pink/paw_coconut_calico_pink_transparent.png",
    thumb: "/cat_paws/3_calico_pink/paw_coconut_calico_pink_256.png",
  },
  {
    id: "1_fresh_green",
    name: "青椰萌绿肉球",
    nameEn: "Fresh Mint Paw",
    tag: "清爽青椰",
    tagEn: "Fresh Mint",
    desc: "青椰薄荷清新萌绿肉垫，清爽自然，活力盎然",
    descEn: "Refreshing mint green cat paw with natural vitality",
    src: "/cat_paws/1_fresh_green/paw_coconut_green_transparent.png",
    thumb: "/cat_paws/1_fresh_green/paw_coconut_green_256.png",
  },
  {
    id: "2_warm_brown",
    name: "浓焙椰咖肉球",
    nameEn: "Roasted Caramel Paw",
    tag: "焦糖浓焙",
    tagEn: "Caramel",
    desc: "浓焙椰咖焦糖温暖肉垫，沉稳内敛，醇厚雅致",
    descEn: "Warm roasted caramel cat paw, cozy and elegant",
    src: "/cat_paws/2_warm_brown/paw_coconut_brown_transparent.png",
    thumb: "/cat_paws/2_warm_brown/paw_coconut_brown_256.png",
  },
  {
    id: "4_calico_white",
    name: "三花雪白肉球",
    nameEn: "Snow White Paw",
    tag: "纯净雪白",
    tagEn: "Snow White",
    desc: "雪白三花金肉垫，温润明亮，高对比超清晰",
    descEn: "Bright snow white cat paw with clear contrast",
    src: "/cat_paws/4_calico_white/paw_coconut_calico_white_transparent.png",
    thumb: "/cat_paws/4_calico_white/paw_coconut_calico_white_256.png",
  },
];

/**
 * 获取已保存的猫肉球偏好 (默认: 3_calico_pink)
 */
export function getSavedCatPaw(): string {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("xc_custom_paw");
      if (saved && CAT_PAW_PRESETS.some((p) => p.id === saved)) {
        return saved;
      }
    } catch (_) {}
  }
  return "3_calico_pink";
}

/**
 * 保存猫肉球偏好并广播全局事件通知所有 Logo 实例实时重绘
 */
export function saveCatPaw(pawId: string) {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("xc_custom_paw", pawId);
      window.dispatchEvent(new CustomEvent("xc_cat_paw_changed", { detail: { pawId } }));
    } catch (_) {}
  }
}

/**
 * 获取用户专属保存的自定义调色配方
 */
export function getUserSavedCustomTheme(): CustomThemeConfig | null {
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("xc_user_saved_custom_theme");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (_) {}
  }
  return null;
}

/**
 * 保存用户的专属自定义调色配方
 */
export function saveUserCustomTheme(theme: CustomThemeConfig) {
  if (typeof window !== "undefined") {
    try {
      const toSave = {
        ...theme,
        id: "user_custom",
        name: "我的专属配色",
      };
      localStorage.setItem("xc_user_saved_custom_theme", JSON.stringify(toSave));
    } catch (_) {}
  }
}

/**
 * 删除用户专属自定义调色配方
 */
export function deleteUserCustomTheme() {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem("xc_user_saved_custom_theme");
    } catch (_) {}
  }
}


