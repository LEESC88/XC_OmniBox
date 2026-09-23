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

// 6 款高对比度、清晰透亮的精选预设配方 (WCAG AAA 级对比度优化)
export const THEME_PRESETS: CustomThemeConfig[] = [
  {
    id: "coconut",
    name: "暖椰润肤 (经典浅色)",
    nameEn: "Warm Cream (Classic Light)",
    background: "#F2E5D8",
    foreground: "#FAF1E8",
    accent: "#EA580C",
    textMain: "#0F0703", // 浓郁深焙椰壳木质黑，对比度极高
    textMuted: "#422818", // 调深辅助字色，杜绝发灰
    border: "#C2A895",
    isDark: false,
  },
  {
    id: "obsidian",
    name: "曜黑暗夜 (经典深色)",
    nameEn: "Obsidian Night (Classic Dark)",
    background: "#1A120E",
    foreground: "#261D18",
    accent: "#F97316",
    textMain: "#FFFFFF", // 纯雪白，夜间刺目感已消除，高保真清晰
    textMuted: "#EDE0D4", // 增亮辅助字色，夜间一目了然
    border: "#564034",
    isDark: true,
  },
  {
    id: "sakura",
    name: "樱花奶芙 (甜美轻粉)",
    nameEn: "Sakura Souffle (Sweet Pink)",
    background: "#FDF2F4",
    foreground: "#FFFFFF",
    accent: "#EC4899",
    textMain: "#330219", // 深浓野莓红黑，在粉白底上极度清晰
    textMuted: "#7A1C44",
    border: "#F9A8D4",
    isDark: false,
  },
  {
    id: "mint",
    name: "薄荷苏打 (清新青翠)",
    nameEn: "Mint Soda (Fresh Green)",
    background: "#ECFDF5",
    foreground: "#FFFFFF",
    accent: "#0D9488",
    textMain: "#022C22", // 深浓冷杉墨绿，对比度超强
    textMuted: "#065F46",
    border: "#6EE7B7",
    isDark: false,
  },
  {
    id: "cyber",
    name: "赛博霓紫 (深邃电幻)",
    nameEn: "Cyber Neon (Deep Purple)",
    background: "#0F0B1E",
    foreground: "#1A1435",
    accent: "#8B5CF6",
    textMain: "#FFFFFF",
    textMuted: "#E0D7FE",
    border: "#58429B",
    isDark: true,
  },
  {
    id: "mocha",
    name: "复古暖咖 (雅致皮革)",
    nameEn: "Retro Mocha (Rich Leather)",
    background: "#2B1D14",
    foreground: "#3A291E",
    accent: "#D97706",
    textMain: "#FFF8F0",
    textMuted: "#EAD5BE",
    border: "#6E4E3B",
    isDark: true,
  },
];

// 6 款 Windows 原生预装且风格对比极度悬殊的经典高辨识度字体
export const FONT_PRESETS: FontOption[] = [
  {
    id: "system",
    name: "现代黑体 (系统默认)",
    nameEn: "Modern Sans (System Default)",
    badge: "极简无衬线",
    badgeEn: "Clean Sans",
    desc: "点对点极清锐利，字形方正开阔，与 Windows Segoe UI / 微软雅黑完美融合",
    descEn: "Crisp pixel-aligned glyphs, perfectly unified with Windows Segoe UI",
    sample: "永和九年 岁在癸丑 · Modern UI 123",
    sampleEn: "Sphinx of black quartz, judge my vow · Modern UI 123",
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei UI", "Microsoft YaHei", Roboto, sans-serif',
  },
  {
    id: "kaiti",
    name: "行云楷体 (毛笔书法)",
    nameEn: "Flowing KaiTi (Brush Script)",
    badge: "古风书道",
    badgeEn: "Calligraphy",
    desc: "地道中华毛笔楷书，运笔行云流水，带有真实墨韵与转折顿挫",
    descEn: "Traditional calligraphy with flowing strokes and ink charm",
    sample: "落霞与孤鹜齐飞，秋水共长天一色 · Calligraphy",
    sampleEn: "Pack my box with five dozen liquor jugs · Calligraphy",
    fontFamily: 'KaiTi, "楷体", "STKaiti", "BiauKai", cursive, serif',
  },
  {
    id: "serif",
    name: "人文宋体 (典雅明体)",
    nameEn: "Humanist SongTi (Classic Serif)",
    badge: "文墨书卷",
    badgeEn: "Bookish Serif",
    desc: "横细竖粗，尖锐三角衬线，经典图书报纸高雅铅印质感",
    descEn: "Thin horizontals and thick verticals with sharp triangular serifs",
    sample: "白日依山尽，黄河入海流 · Literature 2026",
    sampleEn: "The quick brown fox jumps over the lazy dog · Literature 2026",
    fontFamily: 'SimSun, "宋体", "STSong", "Songti SC", serif',
  },
  {
    id: "fangsong",
    name: "经典仿宋 (政务公文)",
    nameEn: "Classic FangSong (Formal Print)",
    badge: "刚劲挺秀",
    badgeEn: "Upright Script",
    desc: "字身修长挺拔，笔画刚劲利落，经典公文报告典范用字",
    descEn: "Slender, upright and crisp geometry, standard for official publications",
    sample: "海内存知己，天涯若比邻 · Official Document",
    sampleEn: "Jackdaws love my big sphinx of quartz · Official Document",
    fontFamily: 'FangSong, "仿宋", "STFangsong", serif',
  },
  {
    id: "heavy",
    name: "重装粗黑 (工业特黑)",
    nameEn: "Heavy Industrial (Extra Bold)",
    badge: "厚重硬核",
    badgeEn: "Impact Bold",
    desc: "特粗工业方正笔画，视觉份量饱满沉稳，极具视觉冲击力",
    descEn: "Ultra-thick industrial strokes with bold visual weight and impact",
    sample: "大漠孤烟直，长河落日圆 · HEAVY BOLD",
    sampleEn: "HOW RAZORBACK-JUMPING FROGS CAN LEVEL · HEAVY BOLD",
    fontFamily: 'SimHei, "黑体", "Arial Black", Impact, sans-serif',
  },
  {
    id: "mono",
    name: "极客等宽 (终端代码)",
    nameEn: "Geek Monospace (Code Terminal)",
    badge: "代码等宽",
    badgeEn: "Monospace",
    desc: "严格等宽定宽字符，字母与数字严谨对齐，浓厚黑客极客风",
    descEn: "Strict fixed-width characters with precise letter & number alignment",
    sample: 'const omni = new OmniBox(); // Code 0x88',
    sampleEn: 'const omni = new OmniBox(); // Code 0x88',
    fontFamily: '"Cascadia Code", Consolas, "Courier New", monospace',
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
 * 实时将主题调色注入全局 CSS Custom Properties
 */
export function applyCustomTheme(theme: CustomThemeConfig) {
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

  // 5. 本地缓存当前生效主题配置
  try {
    localStorage.setItem("xc_custom_theme", JSON.stringify(theme));
    localStorage.setItem("xc_theme", theme.isDark ? "dark" : "light");
  } catch (_) {}
}

export function applyCustomFont(fontId: string) {
  if (typeof document === "undefined") return;
  const font = FONT_PRESETS.find((f) => f.id === fontId) || FONT_PRESETS[0];
  const root = document.documentElement;
  root.style.setProperty("--font-family", font.fontFamily);
  root.style.fontFamily = font.fontFamily;
  if (document.body) {
    document.body.style.fontFamily = font.fontFamily;
  }
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
      const saved = localStorage.getItem("xc_custom_theme");
      if (saved) {
        return JSON.parse(saved);
      }
      const isDark = document.documentElement.classList.contains("dark");
      return isDark ? THEME_PRESETS[1] : THEME_PRESETS[0];
    } catch (_) {}
  }
  return THEME_PRESETS[0];
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


