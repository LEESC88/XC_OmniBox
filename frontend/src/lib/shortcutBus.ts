/**
 * 全局快捷键与动作总线 (Shortcut & Action Bus)
 * 支持 Ctrl+Enter (执行操作)、Ctrl+S (下载结果)、Ctrl+1~5 (模块切换)、Ctrl+/ (快捷键帮助)、Ctrl+, (设置)
 */

export type ShortcutAction =
  | "execute-primary"
  | "download-result"
  | "toggle-shortcuts"
  | "toggle-settings"
  | "switch-module";

export interface ShortcutItem {
  key: string;
  labelZh: string;
  labelEn: string;
  descZh: string;
  descEn: string;
  category: "action" | "nav" | "system";
}

export const SHORTCUTS_LIST: ShortcutItem[] = [
  {
    key: "Ctrl + Enter",
    labelZh: "执行当前操作",
    labelEn: "Run Primary Action",
    descZh: "开始压缩/转换/提取/识别/超分等核心运算",
    descEn: "Execute compression, conversion, OCR, or upscale",
    category: "action",
  },
  {
    key: "Ctrl + S",
    labelZh: "快速下载结果",
    labelEn: "Quick Download",
    descZh: "下载当前工具处理生成的文件，免鼠标点击",
    descEn: "Save or download the currently generated output file",
    category: "action",
  },
  {
    key: "Ctrl + V",
    labelZh: "智能剪贴板粘贴",
    labelEn: "Smart Paste",
    descZh: "在任意工具内直接粘贴图片或文本，自动载入",
    descEn: "Paste copied image or text directly into active tool",
    category: "action",
  },
  {
    key: "Ctrl + 1 ~ 5",
    labelZh: "快速切换主模块",
    labelEn: "Switch Module",
    descZh: "1: 文档 | 2: 图像 | 3: 音频 | 4: 实用 | 5: AI",
    descEn: "1: Docs | 2: Image | 3: Audio | 4: Daily | 5: AI",
    category: "nav",
  },
  {
    key: "Ctrl + ,",
    labelZh: "打开系统设置",
    labelEn: "Open Settings",
    descZh: "呼出偏好设置、深浅主题切换与字体微调面板",
    descEn: "Open preferences, theme customization, and font picker",
    category: "system",
  },
  {
    key: "Ctrl + /",
    labelZh: "快捷键指南",
    labelEn: "Shortcuts Guide",
    descZh: "随时按此键查看或隐藏本快捷键速查清单",
    descEn: "Toggle this keyboard shortcuts cheat sheet",
    category: "system",
  },
  {
    key: "Esc",
    labelZh: "关闭当前弹窗",
    labelEn: "Close Modal",
    descZh: "快速关闭设置、版本更新或快捷键弹窗",
    descEn: "Close any open dialog or popup window",
    category: "system",
  },
];

class ShortcutBus {
  private listeners: Map<ShortcutAction, Set<() => void>> = new Map();

  on(action: ShortcutAction, handler: () => void) {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set());
    }
    this.listeners.get(action)!.add(handler);
    return () => {
      this.listeners.get(action)?.delete(handler);
    };
  }

  emit(action: ShortcutAction) {
    const handlers = this.listeners.get(action);
    if (handlers) {
      handlers.forEach((fn) => {
        try {
          fn();
        } catch (e) {
          console.error("[ShortcutBus] Error handling action:", action, e);
        }
      });
    }
  }
}

export const shortcutBus = new ShortcutBus();
