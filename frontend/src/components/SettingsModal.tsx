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
  const [activeTab, setActiveTab] = useState<"general" | "files" | "appearance" | "engine" | "about">("general");
  const [config, setConfig] = useState<DesktopConfig>({
    minimizeToTray: true,
    closeToTray: false,
    openFolderAfterExport: false,
    customExportPath: "",
    autoCheckUpdate: true,
    preferredEngine: "auto",
  });

  const [cacheSize, setCacheSize] = useState<string>("计算中...");
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
      setCacheSize("0.00 MB (纯本地浏览器运算)");
    }
  }, [isOpen]);

  // 保存用户专属自定义主题 (避免误触重置丢失)
  const handleSaveCurrentAsCustomTheme = () => {
    const themeToSave: CustomThemeConfig = {
      ...curTheme,
      id: "user_custom",
      name: "★ 我的专属配色",
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
      name: "自定义调色配方",
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
      <div className="relative w-full max-w-4xl w-[94vw] md:w-[860px] bg-[#FDFBF7] dark:bg-[#1E1713] border border-[#CBB09C] dark:border-[#4D392E] rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[88vh] animate-scale-up text-coconut-950 dark:text-white">
        {/* 左侧导航栏 */}
        <div className="w-full md:w-52 bg-[#F5ECE2] dark:bg-[#18120F] border-b md:border-b-0 md:border-r border-[#D2BCAB] dark:border-[#3D2E26] p-4 sm:p-5 flex flex-col justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2.5 mb-6 px-1">
              <div className="w-9 h-9 rounded-xl bg-accent-gradient flex items-center justify-center text-white shadow-xs">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-coconut-950 dark:text-white leading-tight">
                  偏好设置
                </h3>
                <span className="text-xs text-coconut-700 dark:text-neutral-300 font-mono font-medium">Settings</span>
              </div>
            </div>

            <nav className="space-y-1.5">
              {[
                { id: "general", label: "窗口与系统", icon: Laptop },
                { id: "files", label: "文件与保存", icon: FolderOpen },
                { id: "appearance", label: "外观与界面", icon: Palette },
                { id: "engine", label: "核心引擎", icon: Cpu },
                { id: "about", label: "关于与更新", icon: Sparkles },
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
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
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
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-extrabold text-coconut-950 dark:text-white">
                {activeTab === "general" && "窗口与系统行为"}
                {activeTab === "files" && "文件处理与保存偏好"}
                {activeTab === "appearance" && "外观与界面选项"}
                {activeTab === "engine" && "文档与处理引擎"}
                {activeTab === "about" && "关于万象箱与检查更新"}
              </span>
              {saveSuccess && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold animate-fade-in ml-2">
                  <Check className="w-3.5 h-3.5 stroke-[3]" /> 已自动保存
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-coconut-700 hover:text-coconut-950 dark:text-neutral-200 dark:hover:text-white hover:bg-coconut-200/60 dark:hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 滚动内容区 */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 custom-main-scrollbar">
            {/* 1. 窗口与系统 */}
            {activeTab === "general" && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                        最小化行为（点击窗口右上角 “-” 按钮）
                      </div>
                      <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                        {config.minimizeToTray
                          ? "当前：隐身缩小到任务栏右下角折叠区 (系统托盘待命)"
                          : "当前：缩小到常规任务栏 (传统 Windows 方式)"}
                      </div>
                    </div>
                    <div className="flex bg-coconut-200/90 dark:bg-[#18120F] border border-coconut-300/80 dark:border-neutral-700 p-1 rounded-xl text-xs font-bold">
                      <button
                        onClick={() => updateConfig("minimizeToTray", true)}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          config.minimizeToTray
                            ? "bg-white dark:bg-[#2E241E] text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                            : "text-coconut-800 dark:text-neutral-300 font-semibold"
                        }`}
                      >
                        缩入托盘
                      </button>
                      <button
                        onClick={() => updateConfig("minimizeToTray", false)}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          !config.minimizeToTray
                            ? "bg-white dark:bg-[#2E241E] text-orange-600 dark:text-orange-400 shadow-xs font-bold"
                            : "text-coconut-800 dark:text-neutral-300 font-semibold"
                        }`}
                      >
                        常规任务栏
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      关闭窗口时最小化至托盘后台待命（点击 “X” 按钮）
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      开启后点击关闭不会直接退出软件，而是退至右下角随时秒级唤起
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfig("closeToTray", !config.closeToTray)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
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

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      开机自启动
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      随 Windows 电脑开机自动在后台启动万象箱
                    </div>
                  </div>
                  <button
                    onClick={handleToggleAutoStart}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
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
                        <span>导出与保存路径配置</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          config.customExportPath 
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : "bg-orange-500/15 text-orange-700 dark:text-orange-300"
                        }`}>
                          {config.customExportPath ? "已锁定自定义目录" : "交互询问模式 (系统默认)"}
                        </span>
                      </div>
                      <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                        {config.customExportPath 
                          ? "文件将直接自动保存到您指定的下方文件夹中" 
                          : "每次转换处理完成后由系统弹出窗口询问保存位置，默认起始定位如下"}
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
                        {config.customExportPath ? "自定义" : "系统默认"}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isElectron && (
                        <button
                          onClick={handleSelectFolder}
                          className="px-3.5 py-2.5 bg-accent-gradient hover:opacity-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95 flex-shrink-0 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" /> 更改路径
                        </button>
                      )}

                      {isElectron && (
                        <button
                          onClick={() => handleOpenFolder()}
                          className="px-3 py-2.5 rounded-xl border border-coconut-300 dark:border-neutral-600 bg-white dark:bg-[#2E241E] hover:border-orange-500 text-coconut-900 dark:text-neutral-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95 flex-shrink-0 cursor-pointer"
                          title="在 Windows 资源管理器中打开此文件夹"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-orange-500" /> 打开目录
                        </button>
                      )}

                      {config.customExportPath && (
                        <button
                          onClick={() => updateConfig("customExportPath", "")}
                          className="px-2 py-2 text-xs text-rose-500 hover:text-rose-600 hover:underline flex-shrink-0 font-bold cursor-pointer"
                        >
                          恢复默认
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 详细模式说明提示条 */}
                  <div className="text-[11px] p-2.5 rounded-xl bg-coconut-50/90 dark:bg-[#140E0C] border border-coconut-200/90 dark:border-[#3D2E26] text-coconut-700 dark:text-neutral-300 flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">
                      {config.customExportPath ? (
                        <>所有处理生成的文件将<strong>直接自动输出保存至上述自定义目录</strong>。如需每次由系统询问选择保存路径，点击“恢复默认”即可。</>
                      ) : (
                        <>当前处于<strong>系统询问模式 (默认)</strong>。导出完成时系统将弹出保存对话框，初始定位至您的 Windows 默认下载目录 <code>{defaultDownloadsPath || "Downloads"}</code>，方便您实时自定义文件名与保存位置。</>
                      )}
                    </span>
                  </div>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      导出完成后自动在文件夹中定位文件
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      文件生成下载完成后，自动唤起资源管理器高亮显示目标文件
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfig("openFolderAfterExport", !config.openFolderAfterExport)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
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

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      临时缓存与空间清理
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      当前临时文件缓存占用：<span className="font-mono font-bold text-orange-600 dark:text-orange-400">{cacheSize}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleClearCache}
                    disabled={clearingCache}
                    className="px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                  >
                    {clearingCache ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    一键清理缓存
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
                          <span>萌宠肉球徽标 (Cat Paw Brand Avatar)</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-mono font-bold">
                            4 款真实萌爪
                          </span>
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          自定义左上角品牌猫爪形象，点击即时切换应用并持久保存
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-coconut-700 dark:text-neutral-200">
                      即时生效
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {CAT_PAW_PRESETS.map((paw) => {
                      const isSelected = curPaw === paw.id;
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
                              alt={paw.name}
                              className="w-13 h-13 object-contain drop-shadow-sm select-none pointer-events-none"
                            />
                          </div>

                          <span className="text-xs font-bold text-coconut-950 dark:text-white">
                            {paw.name}
                          </span>
                          <span className="text-[10px] text-coconut-600 dark:text-neutral-300 mt-0.5">
                            {paw.tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* B. 精选主题调色板预设 (6款高保真对比度配方 + 1个专属自定义槽位) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-orange-500" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                          精选主题调色预设 (Theme Presets)
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          即点即切：包含 4 款浅色透亮明快 + 2 款沉稳曜黑暗色 (符合 WCAG AAA 清晰度)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {/* 用户专属自定义主题预设插槽 (User Custom Slot) */}
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
                            <span>★ 我的专属配色</span>
                          </span>
                          <div className="flex items-center gap-1">
                            {curTheme.id === "user_custom" && (
                              <span className="w-4 h-4 rounded-full bg-accent-solid text-white flex items-center justify-center shadow-xs">
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </span>
                            )}
                            <button
                              onClick={handleDeleteCustomTheme}
                              title="删除已保存的专属配色"
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
                            title={`背景: ${userSavedTheme.background}`}
                          />
                          <span
                            className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                            style={{ backgroundColor: userSavedTheme.foreground }}
                            title={`面板: ${userSavedTheme.foreground}`}
                          />
                          <span
                            className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                            style={{ backgroundColor: userSavedTheme.accent }}
                            title={`强调: ${userSavedTheme.accent}`}
                          />
                          <span className="text-xs font-bold text-orange-900 dark:text-orange-300 ml-auto font-mono">
                            专属
                          </span>
                        </div>
                      </button>
                    )}

                    {THEME_PRESETS.map((p) => {
                      const isSelected = curTheme.id === p.id;
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
                              {p.name.split(" ")[0]}
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
                              title={`背景: ${p.background}`}
                            />
                            <span
                              className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                              style={{ backgroundColor: p.foreground }}
                              title={`面板: ${p.foreground}`}
                            />
                            <span
                              className="w-4 h-4 rounded-md shadow-xs flex-shrink-0 border border-black/15 dark:border-white/10"
                              style={{ backgroundColor: p.accent }}
                              title={`强调: ${p.accent}`}
                            />
                            <span className="text-xs font-bold text-coconut-800 dark:text-neutral-200 ml-auto font-mono">
                              {p.isDark ? "暗色" : "浅色"}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* C. 高级调色区 (Custom Palette Studio - 一行一个) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-accent" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white flex items-center gap-2">
                          <span>自定义调色工坊 (Color Studio)</span>
                          {curTheme.id === "custom" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-solid text-white font-mono font-bold">
                              调色中
                            </span>
                          )}
                          {curTheme.id === "user_custom" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-solid text-white font-mono font-bold">
                              专属配色中
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          自由调校窗口背景、前景面板、核心强调色及文本与边框
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 保存为专属主题按钮：防止误触丢失 */}
                      <button
                        onClick={handleSaveCurrentAsCustomTheme}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 bg-accent-gradient text-white flex items-center gap-1.5 shadow-xs hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                        title="将当前调色保存为专属配色，永久保存在预设中，绝不怕误触重置丢失"
                      >
                        {savedThemeFeedback ? (
                          <>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                            <span>已保存专属主题</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>保存为我的主题</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleResetTheme}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl border border-coconut-300 dark:border-neutral-600 bg-white dark:bg-[#2E241E] hover:border-orange-500 text-coconut-900 dark:text-neutral-100 flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                        title="重置为默认生椰润肤配色 (专属保存的配色依然安全留在上方预设中)"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> 重置默认
                      </button>
                    </div>
                  </div>

                  {/* 调色输入控件：一行一个 (grid-cols-1) 排版，彻底杜绝拥挤与文字截断 */}
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { key: "background", label: "窗口背景", en: "Background", desc: "大画布与侧边栏全局底色" },
                      { key: "foreground", label: "面板卡片", en: "Foreground", desc: "核心功能卡片与容器表面色" },
                      { key: "accent", label: "强调色彩", en: "Accent", desc: "主操作按钮与高光状态色" },
                      { key: "textMain", label: "主要文字", en: "Text", desc: "标题正文高清晰字色 (WCAG AAA)" },
                      { key: "border", label: "边框轮廓", en: "Border", desc: "面板与分割线清晰轮廓边框色" },
                    ].map((item) => {
                      const colorVal = (curTheme as any)[item.key];
                      return (
                        <div
                          key={item.key}
                          className="p-3 px-4 rounded-2xl bg-white dark:bg-[#1F1814] border border-coconut-300/90 dark:border-[#4D392E] flex items-center justify-between gap-3 shadow-2xs transition-all hover:border-orange-400 dark:hover:border-orange-500"
                        >
                          {/* 左侧：专属 40x40 拾色器大色块 */}
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="relative flex-shrink-0 flex items-center justify-center">
                              <input
                                type="color"
                                value={colorVal}
                                onChange={(e) => handleUpdateColor(item.key as any, e.target.value)}
                                className="w-10 h-10 rounded-xl cursor-pointer border-2 border-white/80 dark:border-neutral-600 shadow-xs p-0 bg-transparent block"
                                title="点击打开原生调色盘取色"
                              />
                            </div>

                            {/* 中间：中文名称 + 英文标签 + 说明 (单行平铺，完整字样) */}
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

                          {/* 右侧：Hex 颜色代码输入框 */}
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

                  {/* C. 实时微缩联动效果卡片 (Live Studio Preview) */}
                  <div className="p-3.5 rounded-2xl border border-dashed border-coconut-300 dark:border-[#4D392E] space-y-2 bg-coconut-50/60 dark:bg-[#140E0C]">
                    <div className="text-xs font-bold text-coconut-800 dark:text-neutral-200 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-500" />
                      <span>实时微缩预览效果 (Live Preview)</span>
                    </div>

                    {/* 拟态卡片 */}
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
                            XC OmniBox 调色预览
                          </span>
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-bold text-white shadow-2xs flex-shrink-0"
                            style={{ backgroundColor: curTheme.accent }}
                          >
                            Accent
                          </span>
                        </div>
                        <p className="text-xs truncate font-medium" style={{ color: curTheme.textMuted }}>
                          背景、卡片与强调色实时同步联动已生效
                        </p>
                      </div>

                      {/* 3D 拟态测试按钮 */}
                      <button
                        type="button"
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md active:scale-95 transition-all flex-shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${adjustHex(curTheme.accent, 22)} 0%, ${curTheme.accent} 50%, ${adjustHex(curTheme.accent, -20)} 100%)`,
                          boxShadow: `0 4px 10px -2px ${hexToRgba(curTheme.accent, 0.45)}`,
                        }}
                      >
                        测试按钮
                      </button>
                    </div>
                  </div>
                </div>

                {/* D. 界面字体选择 (Custom Fonts) */}
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-orange-500" />
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white flex items-center gap-2">
                          <span>界面字体偏好 (Custom Fonts)</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-mono font-bold">
                            6 款 Windows 原生字系
                          </span>
                        </div>
                        <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
                          精心甄选 6 款风格差异鲜明的 Windows 原生预装字系，点击即刻全软件无死角换肤生效
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
                                  {f.name}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-700 dark:text-orange-300 font-bold whitespace-nowrap flex-shrink-0">
                                  {f.badge}
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
                              {f.sample}
                            </div>
                          </div>

                          <p className="text-[11px] text-coconut-700 dark:text-neutral-300 leading-snug mt-1">
                            {f.desc}
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
                    Word ↔ PDF 高保真互转引擎首选
                  </div>
                  <div className="space-y-2.5">
                    {[
                      { id: "auto", title: "智能自适应检测 (推荐)", desc: "自动侦测本机 Microsoft Word COM 与 LibreOffice，选拔最高画质通道" },
                      { id: "word_com", title: "原生 Windows Word COM 引擎", desc: "依托本机已安装的 Microsoft Office，300+ DPI 打印级无损矢量输出" },
                      { id: "libreoffice", title: "LibreOffice 独立引擎", desc: "开源跨平台解析核心，适合未安装正版 Office 的电脑" },
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

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      后端专属服务端口
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      当前监听端口：<span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">18520</span>（专属安全独立通道，杜绝与 8000 端口冲突）
                    </div>
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                    正常运行中
                  </div>
                </div>
              </div>
            )}

            {/* 5. 关于与更新 */}
            {activeTab === "about" && (
              <div className="space-y-4">
                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      启动时自动检查更新
                    </div>
                    <div className="text-xs text-coconut-700 dark:text-neutral-200 mt-1">
                      每次启动应用时在后台静默检查 GitHub 官方版本，有新版时只在侧边栏亮起小红点
                    </div>
                  </div>
                  <button
                    onClick={() => updateConfig("autoCheckUpdate", !config.autoCheckUpdate)}
                    className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ${
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

                <div className="p-4 sm:p-5 rounded-2xl bg-accent-subtle border border-accent-border flex items-center justify-between">
                  <div>
                    <div className="text-xs sm:text-sm font-bold text-coconut-950 dark:text-white">
                      手动检查最新版本
                    </div>
                    <div className="text-xs text-coconut-800 dark:text-neutral-200 mt-1 font-medium">
                      当前版本：v1.0.0（Windows 桌面原生端）
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenUpdateModal();
                    }}
                    className="px-4 py-2 bg-accent-gradient hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95"
                  >
                    前往更新中心
                  </button>
                </div>

                <div className="p-4 sm:p-5 rounded-2xl bg-coconut-100/70 dark:bg-[#251D18] border border-coconut-300/80 dark:border-[#4D392E] text-xs text-coconut-800 dark:text-neutral-200 space-y-2.5">
                  <div className="font-extrabold text-sm text-coconut-950 dark:text-white">
                    XC_OmniBox (XC 万象箱)
                  </div>
                  <p className="text-xs text-coconut-700 dark:text-neutral-200 leading-relaxed font-medium">
                    自然椰香美学 · 极简 · 高保真 · 300+ DPI 无损 · 零隐私泄漏的全能多媒体工作台。
                  </p>
                  <div className="pt-1 flex items-center gap-3">
                    <a
                      href="https://github.com/LEESC88/XC_OmniBox"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
                    >
                      GitHub 开源仓库 <ExternalLink className="w-3.5 h-3.5" />
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
              完成设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
