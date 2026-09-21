"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  ExternalLink,
  Laptop,
} from "lucide-react";

interface UpdateInfo {
  status: "idle" | "checking" | "available" | "not-available" | "downloading" | "ready" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

export default function UpdateModal({
  isOpen,
  onClose,
  triggerFromUser = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  triggerFromUser?: boolean;
}) {
  const [updateState, setUpdateState] = useState<UpdateInfo>({ status: "idle" });
  const [currentVersion, setCurrentVersion] = useState<string>("1.0.0");
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      setIsElectron(true);
      const api = (window as any).electronAPI;

      // 获取当前版本号
      if (api.getAppVersion) {
        api.getAppVersion().then((v: string) => setCurrentVersion(v || "1.0.0"));
      }

      // 监听主进程发出的更新状态
      const unsubscribe = api.onUpdateStatus((data: any) => {
        console.log("[UpdateModal] Received update event:", data);
        if (data.status === "checking") {
          setUpdateState({ status: "checking" });
        } else if (data.status === "available") {
          setUpdateState({ status: "available", version: data.version });
        } else if (data.status === "not-available") {
          setUpdateState({ status: "not-available", version: data.version });
        } else if (data.status === "downloading") {
          setUpdateState({ status: "downloading", percent: data.percent });
        } else if (data.status === "ready") {
          setUpdateState({ status: "ready", version: data.version });
        } else if (data.status === "error") {
          const msg = data.message || "";
          if (msg.includes("No published") || msg.includes("404") || msg.includes("Cannot find")) {
            setUpdateState({ status: "not-available" });
          } else {
            setUpdateState({ status: "error", message: data.message });
          }
        }
      });

      return () => {
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }
  }, []);

  const handleCheckUpdates = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      setUpdateState({ status: "checking" });
      try {
        await (window as any).electronAPI.checkForUpdates();
      } catch (err: any) {
        setUpdateState({ status: "error", message: err.message || "无法连接更新服务器" });
      }
    }
  };

  const handleStartDownload = async () => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      setUpdateState({ status: "downloading", percent: 0 });
      try {
        await (window as any).electronAPI.startDownload();
      } catch (err: any) {
        setUpdateState({ status: "error", message: err.message || "下载启动失败" });
      }
    }
  };

  const handleQuitAndInstall = () => {
    if (typeof window !== "undefined" && (window as any).electronAPI) {
      (window as any).electronAPI.quitAndInstall();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in">
      <div className="relative w-full max-w-md p-6 bg-[#FDFBF7] dark:bg-[#251E1A] border border-[#D2BCAB] dark:border-[#4D392E] rounded-3xl shadow-2xl transition-all">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-coconut-400 hover:text-coconut-800 dark:hover:text-white rounded-full hover:bg-coconut-100 dark:hover:bg-darkbg-elevated transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* 顶部图标与标题 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-accent-gradient flex items-center justify-center text-white shadow-md">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-coconut-950 dark:text-white">
              软件更新中心
            </h3>
            <p className="text-xs text-coconut-700 dark:text-neutral-200 mt-0.5">
              当前版本：v{currentVersion} {isElectron ? "(桌面原生端)" : "(在线网页端)"}
            </p>
          </div>
        </div>

        {/* 内容展示区 */}
        <div className="my-5 p-4 rounded-2xl bg-coconut-100/70 dark:bg-[#1E1713] border border-coconut-200 dark:border-[#4D392E]">
          {!isElectron ? (
            <div className="space-y-2 text-xs text-coconut-800 dark:text-neutral-200">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                <Laptop className="w-4 h-4" /> 您当前使用的是在线网页版
              </div>
              <p>桌面原生端已支持 Windows 一键安装与静默自动升级。您可以前往 GitHub 下载最新 Windows 安装包使用。</p>
              <a
                href="https://github.com/LEESC88/XC_OmniBox/releases"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
              >
                前往 Releases 页面下载安装包 <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          ) : updateState.status === "idle" ? (
            <div className="text-center py-3">
              <p className="text-xs text-coconut-800 dark:text-neutral-200 mb-3">
                点击下方按钮检查是否有新版本发布。
              </p>
              <button
                onClick={handleCheckUpdates}
                className="px-4 py-2 bg-accent-gradient hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95"
              >
                立即检查新版本
              </button>
            </div>
          ) : updateState.status === "checking" ? (
            <div className="flex flex-col items-center justify-center py-4 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <p className="text-xs font-medium text-coconut-900 dark:text-white">
                正在联网检查最新版本...
              </p>
            </div>
          ) : updateState.status === "not-available" ? (
            <div className="flex items-center gap-3 py-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
              <div className="text-xs">
                <div className="font-bold">恭喜，当前已是最新版本！</div>
                <div className="text-coconut-700 dark:text-neutral-200 mt-0.5">
                  所有功能均已升级至最新状态。
                </div>
              </div>
            </div>
          ) : updateState.status === "available" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-bold text-sm">
                <Sparkles className="w-4 h-4" /> 发现新版本：v{updateState.version}！
              </div>
              <p className="text-xs text-coconut-800 dark:text-neutral-200">
                新版本包含功能升级与体验优化。点击下方按钮即可在后台高速静默下载。
              </p>
              <button
                onClick={handleStartDownload}
                className="w-full py-2.5 bg-accent-gradient hover:opacity-95 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> 立即下载更新包
              </button>
            </div>
          ) : updateState.status === "downloading" ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-coconut-900 dark:text-white">
                <span>正在下载新版本安装包...</span>
                <span>{updateState.percent ?? 0}%</span>
              </div>
              <div className="w-full bg-coconut-200 dark:bg-neutral-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-accent-gradient h-full rounded-full transition-all duration-300"
                  style={{ width: `${updateState.percent ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-coconut-700 dark:text-neutral-200 text-center pt-1">
                下载完成后将自动提示您重启替换
              </p>
            </div>
          ) : updateState.status === "ready" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" /> 下载完成，随时可安装升级！
              </div>
              <p className="text-xs text-coconut-800 dark:text-neutral-200">
                点击下方按钮，软件将自动关闭、秒级完成文件覆盖，并重新启动进入最新版本。
              </p>
              <button
                onClick={handleQuitAndInstall}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> 重启应用并完成升级
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{updateState.message || "检查更新出现异常"}</span>
              </div>
              <button
                onClick={handleCheckUpdates}
                className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-bold"
              >
                重试一次
              </button>
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-coconut-700 dark:text-neutral-200 hover:text-coconut-950 dark:hover:text-white transition-colors"
          >
            关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
}
