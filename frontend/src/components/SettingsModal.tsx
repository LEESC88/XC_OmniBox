"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Sliders,
  FolderOpen,
  Trash2,
  Palette,
  Cpu,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  Sun,
  Moon,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

import {
  DEFAULT_WHITE_THEME,
  DEFAULT_DARK_THEME,
  CustomThemeConfig,
  applyCustomTheme,
  previewTheme,
  previewFont,
  applyCustomFont,
  getSavedFont,
  getSavedWhiteTheme,
  getSavedDarkTheme,
  saveWhiteTheme,
  saveDarkTheme,
  adjustHex,
  hexToRgba,
  FONT_PRESETS,
  CAT_PAW_PRESETS,
  getSavedCatPaw,
  saveCatPaw,
} from "@/lib/themeManager";
import CatPawLogo from "@/components/CatPawLogo";
import { useI18n, Language } from "@/lib/i18n";

interface DesktopConfig {
  minimizeToTray: boolean;
  closeToTray: boolean;
  openFolderAfterExport: boolean;
  customExportPath: string;
  defaultDownloadsPath?: string;
  autoCheckUpdate: boolean;
  preferredEngine: "auto" | "word_com" | "libreoffice";
  customTheme?: CustomThemeConfig;
  customFont?: string;
  customPaw?: string;
  language?: Language;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onOpenUpdateModal: () => void;
}

export default function SettingsModal({
  isOpen,
  onClose,
  isDark,
  onToggleTheme,
  onOpenUpdateModal,
}: SettingsModalProps) {
  const { lang, setLang, t } = useI18n();
  const [activeTab, setActiveTab] = useState<"general" | "files" | "appearance" | "engine" | "about">("general");

  // 草稿状态：在未点击“保存设置”前，仅作本地预览，不持久化
  const [draftConfig, setDraftConfig] = useState<DesktopConfig>({
    minimizeToTray: true,
    closeToTray: false,
    openFolderAfterExport: false,
    customExportPath: "",
    autoCheckUpdate: true,
    preferredEngine: "auto",
  });

  const [draftThemeMode, setDraftThemeMode] = useState<"white" | "dark">("white");
  const [draftWhiteTheme, setDraftWhiteTheme] = useState<CustomThemeConfig>(DEFAULT_WHITE_THEME);
  const [draftDarkTheme, setDraftDarkTheme] = useState<CustomThemeConfig>(DEFAULT_DARK_THEME);
  const [draftFont, setDraftFont] = useState<string>("system");
  const [draftPaw, setDraftPaw] = useState<string>("3_calico_pink");
  const [draftLang, setDraftLang] = useState<Language>(lang);
  const [draftAutoStart, setDraftAutoStart] = useState<boolean>(false);

  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const [cacheSize, setCacheSize] = useState<string>(lang === "en" ? "Calculating..." : "计算中...");
  const [clearingCache, setClearingCache] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [defaultDownloadsPath, setDefaultDownloadsPath] = useState<string>("");

  // 快照：记录打开弹窗时的已持久化状态，用于判断 isDirty 以及取消时还原
  const snapshotRef = useRef<{
    config: DesktopConfig;
    whiteTheme: CustomThemeConfig;
    darkTheme: CustomThemeConfig;
    themeMode: "white" | "dark";
    font: string;
    paw: string;
    lang: Language;
    autoStart: boolean;
  }>({
    config: {
      minimizeToTray: true,
      closeToTray: false,
      openFolderAfterExport: false,
      customExportPath: "",
      autoCheckUpdate: true,
      preferredEngine: "auto",
    },
    whiteTheme: DEFAULT_WHITE_THEME,
    darkTheme: DEFAULT_DARK_THEME,
    themeMode: "white",
    font: "system",
    paw: "3_calico_pink",
    lang: "zh",
    autoStart: false,
  });

  // 打开弹窗时初始化草稿与快照
  useEffect(() => {
    if (!isOpen) {
      setIsDirty(false);
      setShowDiscardConfirm(false);
      return;
    }

    const currentMode: "white" | "dark" = (
      document.documentElement.classList.contains("dark") ||
      (typeof localStorage !== "undefined" && localStorage.getItem("xc_theme") === "dark") ||
      isDark
    ) ? "dark" : "white";

    const savedWhite = getSavedWhiteTheme();
    const savedDark = getSavedDarkTheme();
    const savedFont = getSavedFont() || "system";
    const savedPaw = getSavedCatPaw() || "3_calico_pink";
    const currentLang: Language = lang;

    let baseConfig: DesktopConfig = {
      minimizeToTray: true,
      closeToTray: false,
      openFolderAfterExport: false,
      customExportPath: "",
      autoCheckUpdate: true,
      preferredEngine: "auto",
    };

    try {
      const localCfg = localStorage.getItem("xc_desktop_config");
      if (localCfg) {
        baseConfig = { ...baseConfig, ...JSON.parse(localCfg) };
      }
    } catch (_) {}

    setDraftConfig(baseConfig);
    setDraftThemeMode(currentMode);
    setDraftWhiteTheme(savedWhite);
    setDraftDarkTheme(savedDark);
    setDraftFont(savedFont);
    setDraftPaw(savedPaw);
    setDraftLang(currentLang);
    setIsDirty(false);

    snapshotRef.current = {
      config: baseConfig,
      whiteTheme: savedWhite,
      darkTheme: savedDark,
      themeMode: currentMode,
      font: savedFont,
      paw: savedPaw,
      lang: currentLang,
      autoStart: false,
    };

    if (typeof window !== "undefined" && (window as any).electronAPI) {
      setIsElectron(true);
      const api = (window as any).electronAPI;

      if (api.getDesktopConfig) {
        api.getDesktopConfig().then((c: DesktopConfig) => {
          if (c) {
            setDraftConfig((prev) => {
              const merged = { ...prev, ...c };
              if (snapshotRef.current) snapshotRef.current.config = merged;
              return merged;
            });
            if (c.defaultDownloadsPath) {
              setDefaultDownloadsPath(c.defaultDownloadsPath);
            }
          }
        });
      }

      if (api.getDefaultPath) {
        api.getDefaultPath().then((defPath: string) => {
          if (defPath) setDefaultDownloadsPath(defPath);
        });
      }

      if (api.getCacheSize) {
        api.getCacheSize().then((res: { formatted: string }) => {
          if (res) setCacheSize(res.formatted);
        });
      }

      if (api.getAutoStart) {
        api.getAutoStart().then((enabled: boolean) => {
          const val = Boolean(enabled);
          setDraftAutoStart(val);
          if (snapshotRef.current) snapshotRef.current.autoStart = val;
        });
      }
    } else {
      setCacheSize(lang === "en" ? "0.00 MB (Local Browser)" : "0.00 MB (纯本地浏览器运算)");
    }
  }, [isOpen]);

  const activeDraftTheme = draftThemeMode === "dark" ? draftDarkTheme : draftWhiteTheme;

  // 模式切换 (White vs Dark)
  const handleSelectMode = (mode: "white" | "dark") => {
    setDraftThemeMode(mode);
    const targetTheme = mode === "dark" ? draftDarkTheme : draftWhiteTheme;
    previewTheme(targetTheme);
    setIsDirty(true);
  };

  // 当前模式调色
  const handleUpdateColor = (key: keyof CustomThemeConfig, value: string) => {
    if (draftThemeMode === "dark") {
      const updated: CustomThemeConfig = { ...draftDarkTheme, isDark: true, [key]: value };
      setDraftDarkTheme(updated);
      previewTheme(updated);
    } else {
      const updated: CustomThemeConfig = { ...draftWhiteTheme, isDark: false, [key]: value };
      setDraftWhiteTheme(updated);
      previewTheme(updated);
    }
    setIsDirty(true);
  };

  // 恢复当前模式默认配色
  const handleResetCurrentModeTheme = () => {
    if (draftThemeMode === "dark") {
      setDraftDarkTheme(DEFAULT_DARK_THEME);
      previewTheme(DEFAULT_DARK_THEME);
    } else {
      setDraftWhiteTheme(DEFAULT_WHITE_THEME);
      previewTheme(DEFAULT_WHITE_THEME);
    }
    setIsDirty(true);
  };

  // 字体切换 (实时预览，不持久化)
  const handleSelectFont = (fontId: string) => {
    setDraftFont(fontId);
    previewFont(fontId);
    setIsDirty(true);
  };

  // 猫肉球切换
  const handleSelectPaw = (pawId: string) => {
    setDraftPaw(pawId);
    setIsDirty(true);
  };

  // 语言切换
  const handleSelectLang = (newLang: Language) => {
    setDraftLang(newLang);
    setIsDirty(true);
  };

  // 桌面配置变更
  const updateDraftConfig = (key: keyof DesktopConfig, value: any) => {
    setDraftConfig((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  // 开机自启草稿切换
  const handleToggleAutoStart = () => {
    setDraftAutoStart((prev) => !prev);
    setIsDirty(true);
  };

  // 文件夹选择 (Electron)
  const handleSelectFolder = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.selectFolder) {
      const folder = await (window as any).electronAPI.selectFolder();
      if (folder) {
        updateDraftConfig("customExportPath", folder);
      }
    }
  };

  // 在系统资源管理器中打开当前保存目录
  const handleOpenFolder = async (folderPath?: string) => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.openPath) {
      await (window as any).electronAPI.openPath(folderPath || draftConfig.customExportPath || defaultDownloadsPath);
    }
  };

  // 清理缓存
  const handleClearCache = async () => {
    setClearingCache(true);
    if (typeof window !== "undefined" && (window as any).electronAPI?.clearCache) {
      await (window as any).electronAPI.clearCache();
      const res = await (window as any).electronAPI.getCacheSize();
      setCacheSize(res?.formatted || "0.00 MB");
    } else {
      try {
        const keys = ["xc_canvas_cache", "xc_temp_previews"];
        keys.forEach((k) => localStorage.removeItem(k));
      } catch (_) {}
      setCacheSize("0.00 MB");
    }
    setTimeout(() => setClearingCache(false), 500);
  };

  // 保存设置 (显式提交保存)
  const handleCommitSave = async () => {
    // 1. 保存深色与浅色专属自定义配置
    saveWhiteTheme(draftWhiteTheme);
    saveDarkTheme(draftDarkTheme);

    // 2. 根据选定的模式持久化并生效主题
    const activeTheme = draftThemeMode === "dark" ? draftDarkTheme : draftWhiteTheme;
    applyCustomTheme(activeTheme);

    // 3. 应用并持久化字体与肉球
    applyCustomFont(draftFont);
    saveCatPaw(draftPaw);

    // 4. 应用语言
    if (draftLang !== lang) {
      setLang(draftLang);
    }

    // 5. 组合并持久化 DesktopConfig
    const finalConfig: DesktopConfig = {
      ...draftConfig,
      language: draftLang,
      customFont: draftFont,
      customPaw: draftPaw,
      customTheme: activeTheme,
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("xc_desktop_config", JSON.stringify(finalConfig));
      } catch (_) {}

      if ((window as any).electronAPI) {
        const api = (window as any).electronAPI;
        if (api.setDesktopConfig) {
          await api.setDesktopConfig(finalConfig);
        }
        if (api.setAutoStart) {
          await api.setAutoStart(draftAutoStart);
        }
      }
    }

    // 更新快照
    snapshotRef.current = {
      config: finalConfig,
      whiteTheme: draftWhiteTheme,
      darkTheme: draftDarkTheme,
      themeMode: draftThemeMode,
      font: draftFont,
      paw: draftPaw,
      lang: draftLang,
      autoStart: draftAutoStart,
    };

    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 350);
  };

  // 请求关闭弹窗 (若有未保存改动则拦截并弹出提示)
  const handleRequestClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  // 确认放弃修改并退出 (回滚样式至快照)
  const handleConfirmDiscard = () => {
    if (snapshotRef.current) {
      const snap = snapshotRef.current;
      const initialTheme = snap.themeMode === "dark" ? snap.darkTheme : snap.whiteTheme;
      previewTheme(initialTheme);
      previewFont(snap.font);
      if (snap.lang !== lang) {
        setLang(snap.lang);
      }
    }
    setShowDiscardConfirm(false);
    setIsDirty(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleRequestClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-4xl w-[94vw] md:w-[920px] bg-[#FDFBF7] dark:bg-[#1E1713] border border-[#CBB09C] dark:border-[#4D392E] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[88vh] animate-scale-up text-coconut-950 dark:text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧导航栏 */}
        <div className="w-full md:w-60 bg-[#F5ECE2] dark:bg-[#18120F] border-b md:border-b-0 md:border-r border-[#D2BCAB] dark:border-[#3D2E26] p-4 sm:p-5 flex flex-col justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-6 px-1">
              <div className="w-9 h-9 rounded-xl bg-accent-gradient flex items-center justify-center text-white shadow-xs flex-shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-extrabold text-coconut-950 dark:text-white leading-tight truncate">
                  {t.settings.title}
                </h3>
                <p className="text-[11px] text-coconut-700 dark:text-neutral-200 truncate mt-0.5 font-medium">
                  {t.settings.subtitle}
                </p>
              </div>
            </div>

            {/* 标签列表 */}
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
              {[
                { id: "general", label: t.settings.generalTab, icon: Sliders },
                { id: "files", label: t.settings.filesTab, icon: FolderOpen },
                { id: "appearance", label: t.settings.appearanceTab, icon: Palette },
                { id: "engine", label: t.settings.engineTab, icon: Cpu },
                { id: "about", label: t.settings.aboutTab, icon: Sparkles },
              ].map((item) => {
                const Icon = item.icon;
                const isCur = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as any)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-left active:scale-95 cursor-pointer ${
                      isCur
                        ? "bg-accent-gradient text-white shadow-xs"
                        : "text-coconut-900 dark:text-neutral-200 hover:bg-coconut-200/70 dark:hover:bg-[#2A201A] hover:text-coconut-950 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="hidden md:block pt-4 border-t border-coconut-300/60 dark:border-[#3D2E26]">
            <span className="text-xs font-mono font-bold text-coconut-700 dark:text-neutral-400">
              XC OmniBox v1.2.0
            </span>
          </div>
        </div>

        {/* 右侧设置内容区 */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#FDFBF7] dark:bg-[#1E1713]">
          {/* 顶栏关闭按钮 */}
          <div className="flex items-center justify-between p-4 px-6 border-b border-[#D2BCAB]/60 dark:border-[#3D2E26]">
            <div className="flex items-center gap-2 min-w-0 mr-3">
              <span className="text-sm sm:text-base font-extrabold text-coconut-950 dark:text-white truncate">
                {activeTab === "general" && t.settings.generalTitle}
                {activeTab === "files" && t.settings.filesTitle}
                {activeTab === "appearance" && t.settings.appearanceTitle}
                {activeTab === "engine" && t.settings.engineTitle}
                {activeTab === "about" && t.settings.aboutTitle}
              </span>
              {saveSuccess && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold animate-fade-in ml-2 flex-shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> {t.settings.autoSaved}
                </span>
              )}
            </div>
            <button
              onClick={handleRequestClose}
              className="p-1.5 rounded-full text-coconut-700 hover:text-coconut-950 dark:text-neutral-200 dark:hover:text-white hover:bg-coconut-200/60 dark:hover:bg-neutral-800 transition-colors flex-shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 滚动内容区 */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-main-scrollbar">
            {/* 1. 窗口与系统 */}
            {activeTab === "general" && (
              <div className="space-y-4">
                {/* 界面显示语言切换卡片 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                        {t.settings.languageLabel}
                      </div>
                      <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                        {t.settings.languageDesc}
                      </div>
                    </div>
                    <div className="flex bg-coconut-200/90 dark:bg-[#18120F] border border-coconut-300/80 dark:border-neutral-700 p-1 rounded-xl text-xs font-bold flex-shrink-0">
                      <button
                        onClick={() => handleSelectLang("zh")}
                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          draftLang === "zh"
                            ? "bg-white dark:bg-[#2E241E] text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                            : "text-coconut-800 dark:text-neutral-300 font-semibold hover:text-coconut-950 dark:hover:text-white"
                        }`}
                      >
                        <span>🇨🇳</span>
                        <span>{lang === "en" ? "Simplified Chinese" : "简体中文"}</span>
                      </button>
                      <button
                        onClick={() => handleSelectLang("en")}
                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          draftLang === "en"
                            ? "bg-white dark:bg-[#2E241E] text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                            : "text-coconut-800 dark:text-neutral-300 font-semibold hover:text-coconut-950 dark:hover:text-white"
                        }`}
                      >
                        <span>🇺🇸</span>
                        <span>{lang === "en" ? "English" : "English"}</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      {t.settings.minimizeTitle}
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      {draftConfig.minimizeToTray ? t.settings.minimizeDescTray : t.settings.minimizeDescTaskbar}
                    </div>
                  </div>
                  <button
                    disabled={!isElectron}
                    onClick={() => updateDraftConfig("minimizeToTray", !draftConfig.minimizeToTray)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 cursor-pointer ${
                      draftConfig.minimizeToTray ? "bg-accent-solid" : "bg-coconut-300 dark:bg-neutral-600"
                    } ${!isElectron ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        draftConfig.minimizeToTray ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      {t.settings.closeToTrayTitle}
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      {t.settings.closeToTrayDesc}
                    </div>
                  </div>
                  <button
                    disabled={!isElectron}
                    onClick={() => updateDraftConfig("closeToTray", !draftConfig.closeToTray)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 cursor-pointer ${
                      draftConfig.closeToTray ? "bg-accent-solid" : "bg-coconut-300 dark:bg-neutral-600"
                    } ${!isElectron ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        draftConfig.closeToTray ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      {t.settings.autoStartTitle}
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      {t.settings.autoStartDesc}
                    </div>
                  </div>
                  <button
                    disabled={!isElectron}
                    onClick={handleToggleAutoStart}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 cursor-pointer ${
                      draftAutoStart ? "bg-accent-solid" : "bg-coconut-300 dark:bg-neutral-600"
                    } ${!isElectron ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        draftAutoStart ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* 2. 文件与存储 */}
            {activeTab === "files" && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      {t.settings.savePathTitle}
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      {draftConfig.customExportPath ? t.settings.savePathCustomDesc : t.settings.savePathSystemDesc}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        readOnly
                        value={draftConfig.customExportPath || defaultDownloadsPath || "C:\\Users\\...\\Downloads"}
                        title={draftConfig.customExportPath || defaultDownloadsPath}
                        className="w-full pl-3 pr-20 py-2.5 text-xs bg-white dark:bg-[#1A1411] border border-coconut-300 dark:border-neutral-600 rounded-xl text-coconut-950 dark:text-white font-mono truncate shadow-inner focus:outline-none"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-coconut-100 dark:bg-neutral-800 text-coconut-700 dark:text-neutral-300">
                        {draftConfig.customExportPath ? t.settings.badgeCustom : t.settings.badgeSystem}
                      </span>
                    </div>

                    <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
                      {isElectron && (
                        <button
                          onClick={handleSelectFolder}
                          className="px-3.5 py-2.5 bg-accent-gradient hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 flex-shrink-0 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> {t.settings.changeFolder}
                        </button>
                      )}

                      {isElectron && (
                        <button
                          onClick={() => handleOpenFolder()}
                          className="px-3 py-2.5 rounded-xl border border-coconut-300 dark:border-neutral-600 bg-white dark:bg-[#2E241E] hover:border-accent text-coconut-900 dark:text-neutral-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 flex-shrink-0 cursor-pointer"
                          title={t.settings.openFolder}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-accent" /> {t.settings.openFolder}
                        </button>
                      )}

                      {draftConfig.customExportPath && (
                        <button
                          onClick={() => updateDraftConfig("customExportPath", "")}
                          className="px-2 py-2 text-xs text-rose-500 hover:text-rose-600 hover:underline flex-shrink-0 font-bold cursor-pointer"
                        >
                          {t.settings.restoreDefault}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="text-[11px] p-2.5 rounded-xl bg-coconut-50/90 dark:bg-[#140E0C] border border-coconut-200/90 dark:border-[#3D2E26] text-coconut-700 dark:text-neutral-300 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {draftConfig.customExportPath ? t.settings.alertCustom : t.settings.alertSystem}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      {t.settings.openFolderAfterExportTitle}
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      {t.settings.openFolderAfterExportDesc}
                    </div>
                  </div>
                  <button
                    onClick={() => updateDraftConfig("openFolderAfterExport", !draftConfig.openFolderAfterExport)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 cursor-pointer ${
                      draftConfig.openFolderAfterExport ? "bg-accent-solid" : "bg-coconut-300 dark:bg-neutral-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        draftConfig.openFolderAfterExport ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      {t.settings.cacheTitle}
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      {t.settings.cacheDescPrefix}<span className="font-mono font-bold text-accent">{cacheSize}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleClearCache}
                    disabled={clearingCache}
                    className="px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 flex-shrink-0 cursor-pointer"
                  >
                    {clearingCache ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {clearingCache ? t.settings.clearingCache : t.settings.clearCacheBtn}
                  </button>
                </div>
              </div>
            )}

            {/* 3. 外观与个性化 (White vs Dark & English Fonts) */}
            {activeTab === "appearance" && (
              <div className="space-y-5">
                {/* A. 萌宠肉球形象切换 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-darkbg-card flex items-center justify-center p-1 border border-orange-200/80 dark:border-darkbg-border flex-shrink-0">
                        <CatPawLogo size={24} pawId={draftPaw} className="pointer-events-none" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white flex items-center gap-2">
                          <span>{t.settings.pawSectionTitle}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-subtle text-accent font-mono font-bold">
                            {t.settings.pawBadge}
                          </span>
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          {t.settings.pawDesc}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CAT_PAW_PRESETS.map((paw) => {
                      const isSelected = draftPaw === paw.id;
                      const pawDisplayName = lang === "en"
                        ? (paw.id === "1_tabby_brown" ? "Brown Tabby" : paw.id === "2_ginger_orange" ? "Ginger Orange" : paw.id === "3_calico_pink" ? "Calico Pink" : "Tuxedo Black")
                        : paw.name;
                      const pawDisplayTag = lang === "en"
                        ? (paw.id === "3_calico_pink" ? "Default" : "Paw")
                        : paw.tag;
                      return (
                        <button
                          key={paw.id}
                          onClick={() => handleSelectPaw(paw.id)}
                          className={`p-3 rounded-2xl border text-center transition-all relative flex flex-col items-center group cursor-pointer ${
                            isSelected
                              ? "border-accent bg-white dark:bg-[#2E241E] ring-2 ring-accent/30 shadow-md scale-[1.02]"
                              : "border-coconut-300/80 dark:border-[#4D392E] hover:border-accent bg-white/80 dark:bg-[#1F1814] hover:dark:bg-[#261E19] hover:scale-[1.01]"
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center shadow-xs">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}

                          <div className="w-16 h-16 rounded-2xl bg-coconut-100/60 dark:bg-[#150F0D] flex items-center justify-center mb-2 p-1.5 border border-coconut-200/80 dark:border-[#3D2E26] group-hover:scale-110 transition-transform duration-300 shadow-inner">
                            <img
                              src={paw.src}
                              alt={pawDisplayName}
                              className="w-13 h-13 object-contain drop-shadow-sm select-none pointer-events-none"
                            />
                          </div>

                          <span className="text-xs font-bold text-coconut-950 dark:text-white">
                            {pawDisplayName}
                          </span>
                          <span className="text-[10px] text-coconut-600 dark:text-neutral-300 mt-0.5">
                            {pawDisplayTag}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* B. 主题模式切换 (纯白与深黑，各自独立保存自定义配色) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-accent" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                          {lang === "en" ? "Theme Mode System" : "主题模式系统 (极简白与深黑)"}
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          {lang === "en"
                            ? "Independent custom color recipes for White and Dark modes"
                            : "浅色与深色模式各自独立保存自定义配色，切换模式不丢失个性化设置"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 纯白/浅色模式 */}
                    <button
                      type="button"
                      onClick={() => handleSelectMode("white")}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative cursor-pointer ${
                        draftThemeMode === "white"
                          ? "border-accent bg-white dark:bg-[#2E241E] ring-2 ring-accent/30 shadow-md scale-[1.01]"
                          : "border-coconut-300/80 dark:border-[#4D392E] hover:border-accent/60 bg-white/80 dark:bg-[#1F1814]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Sun className="w-4 h-4 text-amber-500" />
                          <span className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                            {lang === "en" ? "White / Light Mode" : "浅色模式 (White)"}
                          </span>
                        </div>
                        {draftThemeMode === "white" && (
                          <span className="w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-coconut-100/80 dark:bg-[#140E0C] border border-coconut-200 dark:border-[#382820]">
                        <span className="w-4 h-4 rounded-md shadow-xs border border-black/15" style={{ backgroundColor: draftWhiteTheme.background }} />
                        <span className="w-4 h-4 rounded-md shadow-xs border border-black/15" style={{ backgroundColor: draftWhiteTheme.foreground }} />
                        <span className="w-4 h-4 rounded-md shadow-xs border border-black/15" style={{ backgroundColor: draftWhiteTheme.accent }} />
                        <span className="text-xs font-bold text-coconut-800 dark:text-neutral-200 ml-auto font-mono">
                          #F8FAFC
                        </span>
                      </div>
                    </button>

                    {/* 极简深黑模式 */}
                    <button
                      type="button"
                      onClick={() => handleSelectMode("dark")}
                      className={`p-3.5 rounded-2xl border text-left transition-all relative cursor-pointer ${
                        draftThemeMode === "dark"
                          ? "border-accent bg-white dark:bg-[#2E241E] ring-2 ring-accent/30 shadow-md scale-[1.01]"
                          : "border-coconut-300/80 dark:border-[#4D392E] hover:border-accent/60 bg-white/80 dark:bg-[#1F1814]"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Moon className="w-4 h-4 text-blue-400" />
                          <span className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                            {lang === "en" ? "Dark / Deep Mode" : "深色模式 (Dark)"}
                          </span>
                        </div>
                        {draftThemeMode === "dark" && (
                          <span className="w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center shadow-xs">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-coconut-100/80 dark:bg-[#140E0C] border border-coconut-200 dark:border-[#382820]">
                        <span className="w-4 h-4 rounded-md shadow-xs border border-white/10" style={{ backgroundColor: draftDarkTheme.background }} />
                        <span className="w-4 h-4 rounded-md shadow-xs border border-white/10" style={{ backgroundColor: draftDarkTheme.foreground }} />
                        <span className="w-4 h-4 rounded-md shadow-xs border border-white/10" style={{ backgroundColor: draftDarkTheme.accent }} />
                        <span className="text-xs font-bold text-coconut-800 dark:text-neutral-200 ml-auto font-mono">
                          #0F172A
                        </span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* C. 专属模式调色工坊 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-accent" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white flex items-center gap-2">
                          <span>{lang === "en" ? "Fine-Tune Mode Colors" : "当前模式调色工坊"}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-solid text-white font-mono font-bold">
                            {draftThemeMode === "dark"
                              ? (lang === "en" ? "Dark Mode Recipe" : "深色专属配方")
                              : (lang === "en" ? "White Mode Recipe" : "浅色专属配方")}
                          </span>
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          {lang === "en"
                            ? "Real-time preview enabled. Click Save Settings below to apply permanently."
                            : "调色实时预览生效，未点击底部“保存设置”前关闭将提示确认"}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleResetCurrentModeTheme}
                      className="text-xs font-bold px-3 py-1.5 rounded-xl border border-coconut-300 dark:border-neutral-600 bg-white dark:bg-[#2E241E] hover:border-accent text-coconut-900 dark:text-neutral-100 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                      title={lang === "en" ? "Reset to Default for this mode" : "恢复当前模式默认配色"}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{lang === "en" ? "Reset Default" : "恢复模式默认"}</span>
                    </button>
                  </div>

                  {/* 调色输入控件 5 项 */}
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { key: "background", label: lang === "en" ? "Window Canvas" : "窗口背景", en: "Canvas", desc: lang === "en" ? "Base canvas and sidebar background color" : "大画布与侧边栏全局底色" },
                      { key: "foreground", label: lang === "en" ? "Card Surface" : "面板卡片", en: "Surface", desc: lang === "en" ? "Core functional cards and container surface" : "核心功能卡片与容器表面色" },
                      { key: "accent", label: lang === "en" ? "Accent Brand" : "强调色彩", en: "Accent", desc: lang === "en" ? "Action buttons and highlight state" : "主操作按钮与高光状态色" },
                      { key: "textMain", label: lang === "en" ? "Primary Text" : "主要文字", en: "Text", desc: lang === "en" ? "High-contrast headings and body text" : "标题与主要正文字体色" },
                      { key: "border", label: lang === "en" ? "Border Outline" : "边框轮廓", en: "Border", desc: lang === "en" ? "Dividers and panel outline borders" : "容器边框与分割线轮廓色" },
                    ].map((item) => {
                      const colorVal = (activeDraftTheme as any)[item.key];
                      return (
                        <div
                          key={item.key}
                          className="p-3 px-4 rounded-2xl bg-white dark:bg-[#1F1814] border border-coconut-300/90 dark:border-[#4D392E] flex items-center justify-between gap-3 shadow-2xs transition-all hover:border-accent"
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="relative flex-shrink-0 flex items-center justify-center">
                              <input
                                type="color"
                                value={colorVal}
                                onChange={(e) => handleUpdateColor(item.key as any, e.target.value)}
                                className="w-10 h-10 rounded-xl cursor-pointer border-2 border-white/80 dark:border-neutral-600 shadow-xs p-0 bg-transparent block"
                              />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white whitespace-nowrap">
                                  {item.label}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent-subtle text-accent font-mono font-bold whitespace-nowrap">
                                  {item.en}
                                </span>
                              </div>
                              <p className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5 truncate leading-tight">
                                {item.desc}
                              </p>
                            </div>
                          </div>

                          <div className="flex-shrink-0 flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-coconut-500 dark:text-neutral-400">
                              HEX
                            </span>
                            <input
                              type="text"
                              value={colorVal}
                              maxLength={7}
                              onChange={(e) => handleUpdateColor(item.key as any, e.target.value)}
                              className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold rounded-xl border border-coconut-300 dark:border-neutral-600 bg-coconut-50/80 dark:bg-[#140E0C] text-center text-coconut-950 dark:text-white uppercase shadow-inner focus:ring-2 focus:ring-accent/30 focus:border-accent outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 实时微缩联动效果卡片 */}
                  <div className="p-3.5 rounded-2xl border border-dashed border-coconut-300 dark:border-[#4D392E] space-y-2 bg-coconut-50/60 dark:bg-[#140E0C]">
                    <div className="text-xs font-bold text-coconut-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent" />
                      <span>{t.settings.livePreviewTitle}</span>
                    </div>

                    <div
                      className="p-3.5 rounded-2xl border transition-all duration-300 shadow-sm flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: activeDraftTheme.foreground,
                        borderColor: activeDraftTheme.border,
                        color: activeDraftTheme.textMain,
                      }}
                    >
                      <div className="space-y-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-extrabold truncate" style={{ color: activeDraftTheme.textMain }}>
                            {t.settings.previewCardTitle}
                          </span>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white shadow-2xs flex-shrink-0"
                            style={{ backgroundColor: activeDraftTheme.accent }}
                          >
                            Accent
                          </span>
                        </div>
                        <p className="text-xs truncate font-medium" style={{ color: activeDraftTheme.textMuted }}>
                          {t.settings.previewCardDesc}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all flex-shrink-0 cursor-pointer"
                        style={{
                          background: `linear-gradient(135deg, ${adjustHex(activeDraftTheme.accent, 22)} 0%, ${activeDraftTheme.accent} 50%, ${adjustHex(activeDraftTheme.accent, -20)} 100%)`,
                          boxShadow: `0 4px 10px -2px ${hexToRgba(activeDraftTheme.accent, 0.45)}`,
                        }}
                      >
                        {t.settings.testBtn}
                      </button>
                    </div>
                  </div>
                </div>

                {/* D. 界面英文标准字体选择 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-accent" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white flex items-center gap-2">
                          <span>{t.settings.fontSectionTitle}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-subtle text-accent font-mono font-bold">
                            {t.settings.fontBadge}
                          </span>
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          {lang === "en" ? "Standard UI fonts with live English rendering preview" : "标准清晰界面英文字体，实时预览与排版渲染"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {FONT_PRESETS.map((f) => {
                      const isCur = draftFont === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSelectFont(f.id)}
                          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                            isCur
                              ? "border-accent bg-white dark:bg-[#2E241E] ring-2 ring-accent/30 shadow-md"
                              : "border-coconut-300/80 dark:border-[#4D392E] hover:border-accent bg-white/80 dark:bg-[#1F1814] hover:dark:bg-[#261E19] shadow-2xs"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white truncate"
                                  style={{ fontFamily: f.fontFamily }}
                                >
                                  {lang === "en" ? (f.nameEn || f.name) : f.name}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-subtle text-accent font-bold whitespace-nowrap flex-shrink-0">
                                  {lang === "en" ? (f.badgeEn || f.badge) : f.badge}
                                </span>
                              </div>
                              {isCur && (
                                <span className="w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center shadow-xs flex-shrink-0">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                            </div>

                            <div
                              className="my-2 p-2.5 rounded-xl border border-coconut-200 dark:border-[#3D2E26] bg-coconut-50/70 dark:bg-[#140E0C] text-coconut-900 dark:text-neutral-100 text-xs sm:text-sm font-semibold truncate shadow-inner select-none font-mono"
                              style={{ fontFamily: f.fontFamily }}
                            >
                              {f.sample}
                            </div>
                          </div>

                          <p className="text-[11px] text-coconut-700 dark:text-neutral-300 leading-snug mt-1">
                            {lang === "en" ? (f.descEn || f.desc) : f.desc}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. 核心引擎 */}
            {activeTab === "engine" && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                    {t.settings.engineTitleSection}
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { id: "auto", title: t.settings.engineAuto, desc: t.settings.engineAutoDesc },
                      { id: "word_com", title: t.settings.engineCom, desc: t.settings.engineComDesc },
                      { id: "libreoffice", title: t.settings.engineLo, desc: t.settings.engineLoDesc },
                    ].map((eng) => (
                      <div
                        key={eng.id}
                        onClick={() => updateDraftConfig("preferredEngine", eng.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                          draftConfig.preferredEngine === eng.id
                            ? "border-accent bg-white dark:bg-[#2E241E] ring-1 ring-accent/30 shadow-xs"
                            : "border-coconut-300 dark:border-[#4D392E] bg-white/70 dark:bg-[#1F1814] hover:dark:bg-[#261E19]"
                        }`}
                      >
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">{eng.title}</div>
                          <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">{eng.desc}</div>
                        </div>
                        {draftConfig.preferredEngine === eng.id && (
                          <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      {t.settings.backendPortTitle}
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      {t.settings.backendPortDesc}
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex-shrink-0">
                    {t.settings.runningNormally}
                  </div>
                </div>
              </div>
            )}

            {/* 5. 关于与更新 */}
            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      {t.settings.autoCheckUpdateTitle}
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      {t.settings.autoCheckUpdateDesc}
                    </div>
                  </div>
                  <button
                    onClick={() => updateDraftConfig("autoCheckUpdate", !draftConfig.autoCheckUpdate)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 cursor-pointer ${
                      draftConfig.autoCheckUpdate ? "bg-accent-solid" : "bg-coconut-300 dark:bg-neutral-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        draftConfig.autoCheckUpdate ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-accent-subtle border border-accent-border flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      {t.settings.appVersionTitle}
                    </div>
                    <div className="text-xs text-coconut-800 dark:text-neutral-200 mt-1 font-medium">
                      {t.settings.versionLabel}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenUpdateModal();
                    }}
                    className="px-4 py-2 bg-accent-gradient hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    {t.settings.checkUpdateBtn}
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] text-xs text-coconut-800 dark:text-neutral-200 space-y-2.5">
                  <div className="font-extrabold text-sm text-coconut-950 dark:text-white">
                    {lang === "en" ? "XC OmniBox Desktop" : "XC_OmniBox (XC 万象箱)"}
                  </div>
                  <p className="text-xs text-coconut-700 dark:text-neutral-200 leading-relaxed font-medium">
                    {lang === "en"
                      ? "Fast · Minimal · High-fidelity · 300+ DPI lossless · Zero privacy leak offline multimedia & dev toolbox."
                      : "极速 · 极简 · 300+ DPI 无损 · 零隐私泄漏的本地多功能工具箱，100% 本地运算与高保真处理。"}
                  </p>
                  <div className="pt-1 flex items-center gap-3">
                    <a
                      href="https://github.com/LEESC88/XC_OmniBox"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                    >
                      {lang === "en" ? "GitHub Repository" : "GitHub 开源仓库"} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 底部操作按钮栏 */}
          <div className="p-3.5 px-6 border-t border-[#D2BCAB]/60 dark:border-[#3D2E26] flex items-center justify-between bg-coconut-50/70 dark:bg-[#18120F]">
            <div className="flex items-center gap-2">
              {isDirty ? (
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                  {lang === "en" ? "Unsaved changes" : "有未保存的修改"}
                </span>
              ) : (
                <span className="text-xs text-coconut-600 dark:text-neutral-400">
                  {lang === "en" ? "Settings up to date" : "设置已保存同步"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleRequestClose}
                className="px-4 py-2 rounded-xl border border-coconut-300 dark:border-neutral-600 hover:bg-coconut-100 dark:hover:bg-neutral-800 text-coconut-800 dark:text-neutral-200 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
              >
                {lang === "en" ? "Cancel" : "取消"}
              </button>

              <button
                type="button"
                onClick={handleCommitSave}
                className="px-6 py-2 bg-accent-gradient hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>{lang === "en" ? "Save Settings" : "保存设置"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 放弃修改确认对话框 */}
        {showDiscardConfirm && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-[#1E293B] border border-neutral-200 dark:border-neutral-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-amber-500">
                <AlertCircle className="w-6 h-6 flex-shrink-0" />
                <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                  {lang === "en" ? "Discard Unsaved Changes?" : "是否取消修改？"}
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                {lang === "en"
                  ? "You have unsaved changes. Exiting now will discard all modifications and restore previous settings."
                  : "检测到未保存的设置变更。未保存的设置将不会生效，是否确定放弃修改并退出？"}
              </p>
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDiscardConfirm(false)}
                  className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-600 text-xs sm:text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Keep Editing" : "继续编辑"}
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscard}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {lang === "en" ? "Discard & Exit" : "放弃修改并退出"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
