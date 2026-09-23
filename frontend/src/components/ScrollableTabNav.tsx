"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export interface TabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: string;
}

interface ScrollableTabNavProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export default function ScrollableTabNav({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}: ScrollableTabNavProps) {
  const { lang } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isDraggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  // 检查滚动溢出状态
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    // 监听窗口缩放与内容变化
    const observer = new ResizeObserver(checkScroll);
    observer.observe(el);
    window.addEventListener("resize", checkScroll);

    // 滚轮横向滑动映射 (将鼠标滚轮上下滑动转换为左右横移，并阻止外层纵向页面跳动)
    const handleWheel = (e: WheelEvent) => {
      if (el.scrollWidth > el.clientWidth) {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          el.scrollLeft += e.deltaY * 0.95;
          checkScroll();
        }
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", checkScroll);
      el.removeEventListener("wheel", handleWheel);
    };
  }, [checkScroll]);

  // 当 activeTab 改变时，确保当前激活项平滑滚动至可视区域中央
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  // 左右箭头点击滑动
  const scrollByAmount = (amount: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: amount, behavior: "smooth" });
    setTimeout(checkScroll, 300);
  };

  // 鼠标拖拽横向滑动 (Desktop Drag-to-Scroll)
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    isDraggingRef.current = true;
    dragMovedRef.current = false;
    startXRef.current = e.pageX - el.offsetLeft;
    scrollLeftRef.current = el.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    e.preventDefault();
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startXRef.current) * 1.2;
    if (Math.abs(walk) > 4) {
      dragMovedRef.current = true;
    }
    el.scrollLeft = scrollLeftRef.current - walk;
    checkScroll();
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
    setTimeout(() => {
      dragMovedRef.current = false;
    }, 50);
  };

  const handleItemClick = (id: string) => {
    if (dragMovedRef.current) return;
    onTabChange(id);
  };

  return (
    <div className={`relative group w-full ${className}`}>
      {/* 左侧遮罩与滑轮快速左翻箭头 */}
      <div
        className={`absolute left-0 inset-y-0 z-20 flex items-center pr-4 pointer-events-none transition-opacity duration-300 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[var(--color-canvas,#F2E5D8)] to-transparent pointer-events-none" />
        <button
          type="button"
          onClick={() => scrollByAmount(-260)}
          className="relative pointer-events-auto p-1.5 rounded-xl bg-white/90 dark:bg-darkbg-elevated/90 border border-coconut-200/90 dark:border-darkbg-border text-coconut-800 dark:text-darkbg-text shadow-md hover:scale-110 active:scale-95 transition-all backdrop-blur-xs cursor-pointer ml-1"
          title={lang === "en" ? "Scroll Left" : "向左滑移"}
          aria-label={lang === "en" ? "Scroll Left" : "向左滑移"}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* 右侧遮罩与滑轮快速右翻箭头 */}
      <div
        className={`absolute right-0 inset-y-0 z-20 flex items-center pl-4 justify-end pointer-events-none transition-opacity duration-300 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[var(--color-canvas,#F2E5D8)] to-transparent pointer-events-none" />
        <button
          type="button"
          onClick={() => scrollByAmount(260)}
          className="relative pointer-events-auto p-1.5 rounded-xl bg-white/90 dark:bg-darkbg-elevated/90 border border-coconut-200/90 dark:border-darkbg-border text-coconut-800 dark:text-darkbg-text shadow-md hover:scale-110 active:scale-95 transition-all backdrop-blur-xs cursor-pointer mr-1"
          title={lang === "en" ? "Scroll Right" : "向右滑移"}
          aria-label={lang === "en" ? "Scroll Right" : "向右滑移"}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 横向滚动轨道：支持滚轮直接左右横滑、鼠标抓取拖拽、带有专属优雅微滑轨 */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="w-full flex items-center gap-2 overflow-x-auto pb-2.5 pt-0.5 border-b border-coconut-200/80 dark:border-darkbg-border tab-scrollbar select-none cursor-grab active:cursor-grabbing touch-pan-x"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              data-tab-id={tab.id}
              type="button"
              onClick={() => handleItemClick(tab.id)}
              className={`flex items-center space-x-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-2xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap flex-shrink-0 active:scale-95 cursor-pointer ${
                isActive
                  ? "bg-accent-gradient text-white font-bold shadow-3d-sunset scale-[1.02]"
                  : "bg-white/80 dark:bg-darkbg-card text-coconut-700 dark:text-darkbg-muted border border-coconut-200/80 dark:border-darkbg-border hover:bg-coconut-100/60 dark:hover:bg-darkbg-elevated hover:dark:text-darkbg-text"
              }`}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono transition-colors ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-coconut-200/80 dark:bg-darkbg-elevated text-coconut-700 dark:text-darkbg-muted"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
