"use client";

import React, { useState, useEffect } from "react";
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
  Laptop,
  Sun,
  Moon,
  Monitor,
  FolderCheck,
  RotateCcw,
  Check,
  AlertCircle,
  Loader2,
} from "lucide-react";

import {
  THEME_PRESETS,
  CustomThemeConfig,
  applyCustomTheme,
  getSavedTheme,
  adjustHex,
  hexToRgba,
  FONT_PRESETS,
  FontOption,
  applyCustomFont,
  getSavedFont,
  CAT_PAW_PRESETS,
  CatPawOption,
  getSavedCatPaw,
  saveCatPaw,
  getUserSavedCustomTheme,
  saveUserCustomTheme,
  deleteUserCustomTheme,
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
  const [config, setConfig] = useState<DesktopConfig>({
    minimizeToTray: true,
    closeToTray: false,
    openFolderAfterExport: false,
    customExportPath: "",
    autoCheckUpdate: true,
    preferredEngine: "auto",
  });

  const [cacheSize, setCacheSize] = useState<string>(lang === "en" ? "Calculating..." : "计算中...");
  const [clearingCache, setClearingCache] = useState(false);
  const [autoStart, setAutoStart] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [defaultDownloadsPath, setDefaultDownloadsPath] = useState<string>("");
  const [curTheme, setCurTheme] = useState<CustomThemeConfig>(THEME_PRESETS[0]);
  const [curFont, setCurFont] = useState<string>("system");
  const [curPaw, setCurPaw] = useState<string>("3_calico_pink");
  const [userSavedTheme, setUserSavedTheme] = useState<CustomThemeConfig | null>(null);
  const [savedThemeFeedback, setSavedThemeFeedback] = useState(false);

  // 初始化加载配置与主题
  useEffect(() => {
    const saved = getSavedTheme();
    if (saved) setCurTheme(saved);

    const savedFont = getSavedFont();
    if (savedFont) setCurFont(savedFont);

    const savedPaw = getSavedCatPaw();
    if (savedPaw) setCurPaw(savedPaw);

    const mySaved = getUserSavedCustomTheme();
    if (mySaved) setUserSavedTheme(mySaved);

    if (typeof window !== "undefined" && (window as any).electronAPI) {
      setIsElectron(true);
      const api = (window as any).electronAPI;

      if (api.getDesktopConfig) {
        api.getDesktopConfig().then((c: DesktopConfig) => {
          if (c) {
            setConfig(c);
            if (c.language) {
              setLang(c.language);
            }
            if (c.defaultDownloadsPath) {
              setDefaultDownloadsPath(c.defaultDownloadsPath);
            }
            if (c.customTheme) {
              setCurTheme(c.customTheme);
              applyCustomTheme(c.customTheme);
            }
            if (c.customFont) {
              setCurFont(c.customFont);
              applyCustomFont(c.customFont);
            }
            if (c.customPaw) {
              setCurPaw(c.customPaw);
              saveCatPaw(c.customPaw);
            }
          }
        });
      }

      if (api.getDefaultPath) {
        api.getDefaultPath().then((defPath: string) => {
          if (defPath) {
            setDefaultDownloadsPath(defPath);
          }
        });
      }

      if (api.getCacheSize) {
        api.getCacheSize().then((res: { formatted: string }) => {
          if (res) setCacheSize(res.formatted);
        });
      }

      if (api.getAutoStart) {
        api.getAutoStart().then((enabled: boolean) => {
          setAutoStart(Boolean(enabled));
        });
      }
    } else {
      // 网页端从 localStorage 加载
      try {
        const localCfg = localStorage.getItem("xc_desktop_config");
        if (localCfg) {
          const parsed = JSON.parse(localCfg);
          setConfig(parsed);
          if (parsed.language) {
            setLang(parsed.language);
          }
          if (parsed.customTheme) {
            setCurTheme(parsed.customTheme);
            applyCustomTheme(parsed.customTheme);
          }
          if (parsed.customFont) {
            setCurFont(parsed.customFont);
            applyCustomFont(parsed.customFont);
          }
          if (parsed.customPaw) {
            setCurPaw(parsed.customPaw);
            saveCatPaw(parsed.customPaw);
          }
        }
      } catch (_) {}
      setCacheSize(lang === "en" ? "0.00 MB (Local Browser)" : "0.00 MB (纯本地浏览器运算)");
    }
  }, [isOpen, lang]);

  // 保存用户专属自定义主题 (避免误触重置丢失)
  const handleSaveCurrentAsCustomTheme = () => {
    const themeToSave: CustomThemeConfig = {
      ...curTheme,
      id: "user_custom",
      name: lang === "en" ? "★ My Custom Theme" : "★ 我的专属配色",
    };
    saveUserCustomTheme(themeToSave);
    setUserSavedTheme(themeToSave);
    setCurTheme(themeToSave);
    applyCustomTheme(themeToSave);
    updateConfig("customTheme", themeToSave);
    setSavedThemeFeedback(true);
    setTimeout(() => setSavedThemeFeedback(false), 2000);
  };

  // 删除用户专属自定义主题
  const handleDeleteCustomTheme = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteUserCustomTheme();
    setUserSavedTheme(null);
    if (curTheme.id === "user_custom") {
      handleSelectPreset(THEME_PRESETS[0]);
    }
  };

  // 猫肉球切换处理器
  const handleSelectPaw = (pawId: string) => {
    setCurPaw(pawId);
    saveCatPaw(pawId);
    updateConfig("customPaw", pawId);
  };

  // 字体切换处理器
  const handleSelectFont = (fontId: string) => {
    setCurFont(fontId);
    applyCustomFont(fontId);
    updateConfig("customFont", fontId);
  };

  // 调色系统与预设切换处理器
  const handleSelectPreset = (preset: CustomThemeConfig) => {
    setCurTheme(preset);
    applyCustomTheme(preset);
    updateConfig("customTheme", preset);
  };

  const handleUpdateColor = (key: keyof CustomThemeConfig, value: string) => {
    const updated: CustomThemeConfig = {
      ...curTheme,
      id: "custom",
      name: lang === "en" ? "Custom Color Recipe" : "自定义调色配方",
      [key]: value,
    };
    setCurTheme(updated);
    applyCustomTheme(updated);
    updateConfig("customTheme", updated);
  };

  const handleResetTheme = () => {
    handleSelectPreset(THEME_PRESETS[0]);
  };

  // 更新配置并持久化
  const updateConfig = (key: keyof DesktopConfig, value: any) => {
    const updated = { ...config, [key]: value };
    setConfig(updated);

    if (typeof window !== "undefined" && (window as any).electronAPI?.setDesktopConfig) {
      (window as any).electronAPI.setDesktopConfig(updated);
    } else {
      localStorage.setItem("xc_desktop_config", JSON.stringify(updated));
    }

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 1500);
  };

  // 选择文件夹
  const handleSelectFolder = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.selectFolder) {
      const folder = await (window as any).electronAPI.selectFolder();
      if (folder) {
        updateConfig("customExportPath", folder);
      }
    }
  };

  // 在系统资源管理器中打开当前保存目录
  const handleOpenFolder = async (folderPath?: string) => {
    if (typeof window !== "undefined" && (window as any).electronAPI?.openPath) {
      await (window as any).electronAPI.openPath(folderPath || config.customExportPath || defaultDownloadsPath);
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
      setCacheSize("0.00 MB");
    }
    setTimeout(() => setClearingCache(false), 500);
  };

  // 切换开机自启
  const handleToggleAutoStart = async () => {
    const nextVal = !autoStart;
    setAutoStart(nextVal);
    if (typeof window !== "undefined" && (window as any).electronAPI?.setAutoStart) {
      await (window as any).electronAPI.setAutoStart(nextVal);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div className="relative w-full max-w-4xl w-[94vw] md:w-[920px] bg-[#FDFBF7] dark:bg-[#1E1713] border border-[#CBB09C] dark:border-[#4D392E] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[88vh] animate-scale-up text-coconut-950 dark:text-white">
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
                <span className="text-xs text-coconut-700 dark:text-neutral-300 font-mono font-medium">Settings</span>
              </div>
            </div>

            <nav className="space-y-1.5">
              {[
                { id: "general", label: t.settings.generalTab, icon: Laptop },
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
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all text-left active:scale-95 ${
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
              XC OmniBox v1.0.0
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
              onClick={onClose}
              className="p-1.5 rounded-full text-coconut-700 hover:text-coconut-950 dark:text-neutral-200 dark:hover:text-white hover:bg-coconut-200/60 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
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
                        onClick={() => {
                          setLang("zh");
                          updateConfig("language", "zh");
                        }}
                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                          lang === "zh"
                            ? "bg-white dark:bg-[#2E241E] text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                            : "text-coconut-800 dark:text-neutral-300 font-semibold hover:text-coconut-950 dark:hover:text-white"
                        }`}
                      >
                        <span>🇨🇳</span>
                        <span>{lang === "en" ? "Simplified Chinese" : "简体中文"}</span>
                      </button>
                      <button
                        onClick={() => {
                          setLang("en");
                          updateConfig("language", "en");
                        }}
                        className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                          lang === "en"
                            ? "bg-white dark:bg-[#2E241E] text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                            : "text-coconut-800 dark:text-neutral-300 font-semibold hover:text-coconut-950 dark:hover:text-white"
                        }`}
                      >
                        <span>🇺🇸</span>
                        <span>English</span>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                        {t.settings.minimizeTitle}
                      </div>
                      <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                        {config.minimizeToTray
                          ? t.settings.minimizeDescTray
                          : t.settings.minimizeDescTaskbar}
                      </div>
                    </div>
                    <div className="flex bg-coconut-200/90 dark:bg-[#18120F] border border-coconut-300/80 dark:border-neutral-700 p-1 rounded-xl text-xs font-bold flex-shrink-0">
                      <button
                        onClick={() => updateConfig("minimizeToTray", true)}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          config.minimizeToTray
                            ? "bg-white dark:bg-[#2E241E] text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                            : "text-coconut-800 dark:text-neutral-300 font-semibold"
                        }`}
                      >
                        {t.settings.minimizeTray}
                      </button>
                      <button
                        onClick={() => updateConfig("minimizeToTray", false)}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          !config.minimizeToTray
                            ? "bg-white dark:bg-[#2E241E] text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                            : "text-coconut-800 dark:text-neutral-300 font-semibold"
                        }`}
                      >
                        {t.settings.minimizeTaskbar}
                      </button>
                    </div>
                  </div>
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
                    onClick={() => updateConfig("closeToTray", !config.closeToTray)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 ${
                      config.closeToTray ? "bg-accent-solid" : "bg-coconut-300 dark:bg-neutral-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        config.closeToTray ? "translate-x-5" : "translate-x-0"
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
                    onClick={handleToggleAutoStart}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 ${
                      autoStart ? "bg-accent-solid" : "bg-coconut-300 dark:bg-neutral-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        autoStart ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* 2. 文件与保存 */}
            {activeTab === "files" && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white flex items-center gap-2">
                        <span>{t.settings.savePathTitle}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          config.customExportPath 
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                        }`}>
                          {config.customExportPath ? t.settings.savePathCustomBadge : t.settings.savePathSystemBadge}
                        </span>
                      </div>
                      <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                        {config.customExportPath 
                          ? t.settings.savePathCustomDesc 
                          : t.settings.savePathSystemDesc}
                      </div>
                    </div>
                  </div>

                  {/* 路径输入框与操作按钮组 */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                      <input
                        type="text"
                        readOnly
                        value={config.customExportPath || defaultDownloadsPath || "C:\\Users\\...\\Downloads"}
                        title={config.customExportPath || defaultDownloadsPath}
                        className="w-full pl-3 pr-20 py-2.5 text-xs bg-white dark:bg-[#1A1411] border border-coconut-300 dark:border-neutral-600 rounded-xl text-coconut-950 dark:text-white font-mono truncate shadow-inner focus:outline-none"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-coconut-100 dark:bg-neutral-800 text-coconut-700 dark:text-neutral-300">
                        {config.customExportPath ? t.settings.badgeCustom : t.settings.badgeSystem}
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
                          className="px-3 py-2.5 rounded-xl border border-coconut-300 dark:border-neutral-600 bg-white dark:bg-[#2E241E] hover:border-orange-500 text-coconut-900 dark:text-neutral-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 flex-shrink-0 cursor-pointer"
                          title={t.settings.openFolder}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-orange-500" /> {t.settings.openFolder}
                        </button>
                      )}

                      {config.customExportPath && (
                        <button
                          onClick={() => updateConfig("customExportPath", "")}
                          className="px-2 py-2 text-xs text-rose-500 hover:text-rose-600 hover:underline flex-shrink-0 font-bold cursor-pointer"
                        >
                          {t.settings.restoreDefault}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 详细模式说明提示条 */}
                  <div className="text-[11px] p-2.5 rounded-xl bg-coconut-50/90 dark:bg-[#140E0C] border border-coconut-200/90 dark:border-[#3D2E26] text-coconut-700 dark:text-neutral-300 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {config.customExportPath ? t.settings.alertCustom : t.settings.alertSystem}
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
                    onClick={() => updateConfig("openFolderAfterExport", !config.openFolderAfterExport)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 ${
                      config.openFolderAfterExport ? "bg-accent-solid" : "bg-coconut-300 dark:bg-neutral-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        config.openFolderAfterExport ? "translate-x-5" : "translate-x-0"
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
                      {t.settings.cacheDescPrefix}<span className="font-mono font-bold text-orange-600 dark:text-orange-400">{cacheSize}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleClearCache}
                    disabled={clearingCache}
                    className="px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 flex-shrink-0"
                  >
                    {clearingCache ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {clearingCache ? t.settings.clearingCache : t.settings.clearCacheBtn}
                  </button>
                </div>
              </div>
            )}

            {/* 3. 外观与个性化调色工坊 (Color Studio & Presets) */}
            {activeTab === "appearance" && (
              <div className="space-y-5">
                {/* A. 萌宠肉球形象切换 (Cat Paw Avatar - 4 种真实形象) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-darkbg-card flex items-center justify-center p-1 border border-orange-200/80 dark:border-darkbg-border flex-shrink-0">
                        <CatPawLogo size={24} pawId={curPaw} className="pointer-events-none" />
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white flex items-center gap-2">
                          <span>{t.settings.pawSectionTitle}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-mono font-bold">
                            {t.settings.pawBadge}
                          </span>
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          {t.settings.pawDesc}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-coconut-700 dark:text-neutral-200">
                      {t.settings.instantNotice}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CAT_PAW_PRESETS.map((paw) => {
                      const isSelected = curPaw === paw.id;
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
                              ? "border-orange-500 bg-white dark:bg-[#2E241E] ring-2 ring-orange-500/30 shadow-md scale-[1.02]"
                              : "border-coconut-300/80 dark:border-[#4D392E] hover:border-orange-400 bg-white/80 dark:bg-[#1F1814] hover:dark:bg-[#261E19] hover:scale-[1.01]"
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center shadow-xs">
                              <Check className="w-2.5 h-2.5 stroke-[3]" />
                            </span>
                          )}

                          {/* 肉球透明大图展示 */}
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

                {/* B. 精选主题调色板预设 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-orange-500" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                          {t.settings.themeSectionTitle}
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          {t.settings.themeSectionDesc}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {/* 用户专属自定义主题预设插槽 */}
                    {userSavedTheme && (
                      <button
                        onClick={() => handleSelectPreset(userSavedTheme)}
                        className={`p-3 rounded-2xl border text-left transition-all relative group cursor-pointer ${
                          curTheme.id === "user_custom"
                            ? "border-orange-500 bg-white dark:bg-[#2E241E] ring-2 ring-orange-500/30 shadow-md scale-[1.02]"
                            : "border-orange-300/80 dark:border-orange-500/40 hover:border-orange-400 bg-orange-50/40 dark:bg-[#261E19]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs sm:text-sm font-extrabold text-orange-950 dark:text-orange-200 truncate flex items-center gap-1">
                            <span>{t.settings.myCustomTheme}</span>
                          </span>
                          <div className="flex items-center gap-1">
                            {curTheme.id === "user_custom" && (
                              <span className="w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center shadow-xs">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                            <button
                              onClick={handleDeleteCustomTheme}
                              title={t.settings.deleteCustomThemeTip}
                              className="w-4 h-4 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/80 text-neutral-400 hover:text-rose-500 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* 色彩预览 */}
                        <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-coconut-100/80 dark:bg-[#140E0C] border border-orange-200/80 dark:border-orange-500/30">
                          <span
                            className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                            style={{ backgroundColor: userSavedTheme.background }}
                          />
                          <span
                            className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                            style={{ backgroundColor: userSavedTheme.foreground }}
                          />
                          <span
                            className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                            style={{ backgroundColor: userSavedTheme.accent }}
                          />
                          <span className="text-xs font-bold text-orange-900 dark:text-orange-300 ml-auto font-mono">
                            {lang === "en" ? "Custom" : "专属"}
                          </span>
                        </div>
                      </button>
                    )}

                    {THEME_PRESETS.map((p) => {
                      const isSelected = curTheme.id === p.id;
                      const presetDisplayName = lang === "en"
                        ? (p.nameEn || p.name)
                        : p.name.split(" ")[0];
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectPreset(p)}
                          className={`p-3 rounded-2xl border text-left transition-all relative cursor-pointer ${
                            isSelected
                              ? "border-orange-500 bg-white dark:bg-[#2E241E] ring-2 ring-orange-500/30 shadow-md scale-[1.02]"
                              : "border-coconut-300/80 dark:border-[#4D392E] hover:border-orange-400 bg-white/80 dark:bg-[#1F1814] hover:dark:bg-[#261E19]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white truncate">
                              {presetDisplayName}
                            </span>
                            {isSelected && (
                              <span className="w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center shadow-xs">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                          </div>

                          {/* 3色微缩色板预览条 */}
                          <div className="flex items-center gap-1.5 p-1.5 rounded-xl bg-coconut-100/80 dark:bg-[#140E0C] border border-coconut-200 dark:border-[#382820]">
                            <span
                              className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                              style={{ backgroundColor: p.background }}
                            />
                            <span
                              className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                              style={{ backgroundColor: p.foreground }}
                            />
                            <span
                              className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                              style={{ backgroundColor: p.accent }}
                            />
                            <span className="text-xs font-bold text-coconut-800 dark:text-neutral-200 ml-auto font-mono">
                              {p.isDark ? t.settings.themeDark : t.settings.themeLight}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* C. 高级调色区 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-accent" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white flex items-center gap-2">
                          <span>{t.settings.colorStudioTitle}</span>
                          {curTheme.id === "custom" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-solid text-white font-mono font-bold">
                              {t.settings.tuningBadge}
                            </span>
                          )}
                          {curTheme.id === "user_custom" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-solid text-white font-mono font-bold">
                              {t.settings.customBadge}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          {lang === "en" ? "Fine-tune background, foreground panels, accents, and borders" : "自由调校窗口背景、前景面板、核心强调色及文本与边框"}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSaveCurrentAsCustomTheme}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 bg-accent-gradient text-white flex items-center gap-1.5 shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                        title={t.settings.saveCustomThemeBtn}
                      >
                        {savedThemeFeedback ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>{t.settings.savedFeedback}</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{t.settings.saveCustomThemeBtn}</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleResetTheme}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl border border-coconut-300 dark:border-neutral-600 bg-white dark:bg-[#2E241E] hover:border-orange-500 text-coconut-900 dark:text-neutral-100 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                        title={t.settings.resetThemeBtn}
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> {t.settings.resetThemeBtn}
                      </button>
                    </div>
                  </div>

                  {/* 调色输入控件 */}
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { key: "background", label: lang === "en" ? "Background" : "窗口背景", en: "Background", desc: lang === "en" ? "Base canvas and sidebar background color" : "大画布与侧边栏全局底色" },
                      { key: "foreground", label: lang === "en" ? "Card Surface" : "面板卡片", en: "Foreground", desc: lang === "en" ? "Core functional cards and surface color" : "核心功能卡片与容器表面色" },
                      { key: "accent", label: lang === "en" ? "Accent Brand" : "强调色彩", en: "Accent", desc: lang === "en" ? "Action buttons and highlight state" : "主操作按钮与高光状态色" },
                      { key: "textMain", label: lang === "en" ? "Primary Text" : "主要文字", en: "Text", desc: lang === "en" ? "High-contrast headings and body text (WCAG AAA)" : "标题正文高清晰字色 (WCAG AAA)" },
                      { key: "border", label: lang === "en" ? "Border Outline" : "边框轮廓", en: "Border", desc: lang === "en" ? "Pixel-crisp divider and container borders" : "面板与分割线清晰轮廓边框色" },
                    ].map((item) => {
                      const colorVal = (curTheme as any)[item.key];
                      return (
                        <div
                          key={item.key}
                          className="p-3 px-4 rounded-2xl bg-white dark:bg-[#1F1814] border border-coconut-300/90 dark:border-[#4D392E] flex items-center justify-between gap-3 shadow-2xs transition-all hover:border-orange-400 dark:hover:border-orange-500"
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
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-mono font-bold whitespace-nowrap">
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
                              className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold rounded-xl border border-coconut-300 dark:border-neutral-600 bg-coconut-50/80 dark:bg-[#140E0C] text-center text-coconut-950 dark:text-white uppercase shadow-inner focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* C. 实时微缩联动效果卡片 */}
                  <div className="p-3.5 rounded-2xl border border-dashed border-coconut-300 dark:border-[#4D392E] space-y-2 bg-coconut-50/60 dark:bg-[#140E0C]">
                    <div className="text-xs font-bold text-coconut-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                      <span>{t.settings.livePreviewTitle}</span>
                    </div>

                    <div
                      className="p-3.5 rounded-2xl border transition-all duration-300 shadow-sm flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: curTheme.foreground,
                        borderColor: curTheme.border,
                        color: curTheme.textMain,
                      }}
                    >
                      <div className="space-y-1 truncate">
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-extrabold truncate" style={{ color: curTheme.textMain }}>
                            {t.settings.previewCardTitle}
                          </span>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white shadow-2xs flex-shrink-0"
                            style={{ backgroundColor: curTheme.accent }}
                          >
                            Accent
                          </span>
                        </div>
                        <p className="text-xs truncate font-medium" style={{ color: curTheme.textMuted }}>
                          {t.settings.previewCardDesc}
                        </p>
                      </div>

                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${adjustHex(curTheme.accent, 22)} 0%, ${curTheme.accent} 50%, ${adjustHex(curTheme.accent, -20)} 100%)`,
                          boxShadow: `0 4px 10px -2px ${hexToRgba(curTheme.accent, 0.45)}`,
                        }}
                      >
                        {t.settings.testBtn}
                      </button>
                    </div>
                  </div>
                </div>

                {/* D. 界面字体选择 */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-orange-500" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white flex items-center gap-2">
                          <span>{t.settings.fontSectionTitle}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-mono font-bold">
                            {t.settings.fontBadge}
                          </span>
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          {t.settings.fontDesc}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {FONT_PRESETS.map((f) => {
                      const isCur = curFont === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => handleSelectFont(f.id)}
                          className={`p-3.5 rounded-2xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                            isCur
                              ? "border-orange-500 bg-white dark:bg-[#2E241E] ring-2 ring-orange-500/30 shadow-md"
                              : "border-coconut-300/80 dark:border-[#4D392E] hover:border-orange-400 bg-white/80 dark:bg-[#1F1814] hover:dark:bg-[#261E19] shadow-2xs"
                          }`}
                        >
                          <div>
                            {/* 标题 + 徽章 + 选中状态 */}
                            <div className="flex items-center justify-between gap-1.5 mb-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white truncate"
                                  style={{ fontFamily: f.fontFamily }}
                                >
                                  {lang === "en" ? (f.nameEn || f.name) : f.name}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-700 dark:text-orange-300 font-bold whitespace-nowrap flex-shrink-0">
                                  {lang === "en" ? (f.badgeEn || f.badge) : f.badge}
                                </span>
                              </div>
                              {isCur && (
                                <span className="w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center shadow-xs flex-shrink-0">
                                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                                </span>
                              )}
                            </div>

                            {/* 实时超清字样横幅 (Live Typography Banner) */}
                            <div
                              className="my-2 p-2.5 rounded-xl border border-coconut-200 dark:border-[#3D2E26] bg-coconut-50/70 dark:bg-[#140E0C] text-coconut-900 dark:text-neutral-100 text-xs sm:text-sm font-semibold truncate shadow-inner select-none"
                              style={{ fontFamily: f.fontFamily }}
                            >
                              {lang === "en" ? (f.sampleEn || f.sample) : f.sample}
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
                        onClick={() => updateConfig("preferredEngine", eng.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between ${
                          config.preferredEngine === eng.id
                            ? "border-orange-500 bg-white dark:bg-[#2E241E] ring-1 ring-orange-500/30 shadow-xs"
                            : "border-coconut-300 dark:border-[#4D392E] bg-white/70 dark:bg-[#1F1814] hover:dark:bg-[#261E19]"
                        }`}
                      >
                        <div>
                          <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">{eng.title}</div>
                          <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">{eng.desc}</div>
                        </div>
                        {config.preferredEngine === eng.id && (
                          <CheckCircle2 className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
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
                    onClick={() => updateConfig("autoCheckUpdate", !config.autoCheckUpdate)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center flex-shrink-0 ${
                      config.autoCheckUpdate ? "bg-accent-solid" : "bg-coconut-300 dark:bg-neutral-600"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                        config.autoCheckUpdate ? "translate-x-5" : "translate-x-0"
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
                    className="px-4 py-2 bg-accent-gradient hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95"
                  >
                    {t.settings.checkUpdateBtn}
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] text-xs text-coconut-800 dark:text-neutral-200 space-y-2.5">
                  <div className="font-extrabold text-sm text-coconut-950 dark:text-white">
                    {lang === "en" ? "XC OmniBox Studio" : "XC_OmniBox (XC 万象箱)"}
                  </div>
                  <p className="text-xs text-coconut-700 dark:text-neutral-200 leading-relaxed font-medium">
                    {lang === "en"
                      ? "Natural coconut aesthetic · Minimal · High-fidelity · 300+ DPI lossless · Zero privacy leak multimedia creative workshop."
                      : "自然椰香美学 · 极简 · 高保真 · 300+ DPI 无损 · 零隐私泄漏的全能多媒体工作台。"}
                  </p>
                  <div className="pt-1 flex items-center gap-3">
                    <a
                      href="https://github.com/LEESC88/XC_OmniBox"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      {lang === "en" ? "GitHub Repository" : "GitHub 开源仓库"} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 底部按钮栏 */}
          <div className="p-3.5 px-6 border-t border-[#D2BCAB]/60 dark:border-[#3D2E26] flex justify-end bg-coconut-50/70 dark:bg-[#18120F]">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-accent-gradient hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95"
            >
              {lang === "en" ? "Done" : "完成设置"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
