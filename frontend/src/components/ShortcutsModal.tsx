"use client";

import React, { useEffect } from "react";
import { Keyboard, X, Sparkles, Navigation, Laptop } from "lucide-react";
import { SHORTCUTS_LIST } from "@/lib/shortcutBus";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: "zh" | "en";
}

export default function ShortcutsModal({
  isOpen,
  onClose,
  lang = "zh",
}: ShortcutsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = [
    {
      id: "action",
      name: lang === "en" ? "Action & Execution" : "操作与执行",
      icon: Sparkles,
      color: "text-amber-500",
    },
    {
      id: "nav",
      name: lang === "en" ? "Module Navigation" : "模块快速跳转",
      icon: Navigation,
      color: "text-blue-500",
    },
    {
      id: "system",
      name: lang === "en" ? "System & Windows" : "系统与窗口控制",
      icon: Laptop,
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-coconut-50 dark:bg-darkbg-card border border-coconut-200 dark:border-darkbg-border rounded-3xl shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-coconut-200/70 dark:border-darkbg-border flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-coconut-900 dark:text-darkbg-text">
                {lang === "en"
                  ? "Keyboard Shortcuts Guide"
                  : "快捷键与效率指南"}
              </h3>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted">
                {lang === "en"
                  ? "Press Ctrl + / anywhere to toggle"
                  : "随时按 Ctrl + / 即可呼出或隐藏"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-coconut-600 dark:text-darkbg-muted hover:bg-coconut-200/60 dark:hover:bg-darkbg-elevated transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {categories.map((cat) => {
            const items = SHORTCUTS_LIST.filter((i) => i.category === cat.id);
            if (items.length === 0) return null;
            const Icon = cat.icon;
            return (
              <div key={cat.id} className="space-y-2.5">
                <div className="flex items-center space-x-2 text-xs font-bold text-coconut-800 dark:text-darkbg-muted uppercase tracking-wider">
                  <Icon className={`w-3.5 h-3.5 ${cat.color}`} />
                  <span>{cat.name}</span>
                </div>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="p-3 bg-white/70 dark:bg-darkbg-subtle/80 border border-coconut-200/60 dark:border-darkbg-border rounded-2xl flex items-center justify-between gap-3 shadow-sm hover:border-coconut-300 dark:hover:border-darkbg-border/80 transition-colors"
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="text-xs font-bold text-coconut-900 dark:text-darkbg-text truncate">
                          {lang === "en" ? item.labelEn : item.labelZh}
                        </div>
                        <div className="text-[11px] text-coconut-600 dark:text-darkbg-muted truncate">
                          {lang === "en" ? item.descEn : item.descZh}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        {item.key.split(" ").map((k, idx) =>
                          k === "+" ? (
                            <span
                              key={idx}
                              className="text-xs text-coconut-400 font-mono"
                            >
                              +
                            </span>
                          ) : (
                            <kbd
                              key={idx}
                              className="px-2 py-1 text-[11px] font-mono font-bold rounded-lg bg-coconut-100 dark:bg-darkbg-elevated border border-coconut-300/80 dark:border-darkbg-border text-coconut-800 dark:text-darkbg-text shadow-inner"
                            >
                              {k}
                            </kbd>
                          ),
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-coconut-100/50 dark:bg-darkbg-subtle/50 border-t border-coconut-200/60 dark:border-darkbg-border flex items-center justify-between text-xs text-coconut-600 dark:text-darkbg-muted"></div>
      </div>
    </div>
  );
}
