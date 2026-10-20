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
      {/* 左侧快速左翻箭头 */}
      <div
        className={`absolute left-1 inset-y-0 z-20 flex items-center pointer-events-none transition-opacity duration-200 ${
          canScrollLeft ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByAmount(-240)}
          className="relative pointer-events-auto p-1.5 rounded-xl bg-white/95 dark:bg-darkbg-elevated/95 border border-[var(--color-border)] text-coconut-800 dark:text-darkbg-text shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={lang === "en" ? "Scroll Left" : "向左滑移"}
          aria-label={lang === "en" ? "Scroll Left" : "向左滑移"}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 右侧快速右翻箭头 */}
      <div
        className={`absolute right-1 inset-y-0 z-20 flex items-center justify-end pointer-events-none transition-opacity duration-200 ${
          canScrollRight ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={() => scrollByAmount(240)}
          className="relative pointer-events-auto p-1.5 rounded-xl bg-white/95 dark:bg-darkbg-elevated/95 border border-[var(--color-border)] text-coconut-800 dark:text-darkbg-text shadow-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={lang === "en" ? "Scroll Right" : "向右滑移"}
          aria-label={lang === "en" ? "Scroll Right" : "向右滑移"}
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 现代分段式导航轨道：纯净无冗余徽章，支持滚轮与拖拽 */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        className="w-full flex items-center gap-1 overflow-x-auto p-1.5 rounded-2xl bg-black/[0.035] dark:bg-white/[0.04] border border-[var(--color-border)] no-scrollbar select-none cursor-grab active:cursor-grabbing touch-pan-x"
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
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-[13px] transition-all duration-150 whitespace-nowrap flex-shrink-0 active:scale-[0.98] cursor-pointer ${
                isActive
                  ? "bg-white dark:bg-[#2A2421] text-coconut-950 dark:text-white font-bold shadow-xs ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                  : "text-coconut-600 dark:text-darkbg-muted font-medium hover:text-coconut-950 dark:hover:text-white hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
              }`}
            >
              {Icon && (
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? "text-accent" : "text-coconut-500 dark:text-darkbg-muted"
                  }`}
                />
              )}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
