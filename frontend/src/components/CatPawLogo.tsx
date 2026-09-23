"use client";

import React, { useEffect, useState } from "react";
import { CAT_PAW_PRESETS, getSavedCatPaw } from "@/lib/themeManager";
import { useI18n } from "@/lib/i18n";

interface CatPawLogoProps {
  className?: string;
  size?: number;
  pawId?: string;
}

/**
 * 真实萌系「猫肉球」品牌徽标组件 (Cat Paw Avatar)
 * 支持 4 款精选真实高清猫肉球 (默认: 3_calico_pink 三花粉嫩肉球)
 * 具备全局事件动态监听，用户在设置中切换即时生效
 */
export default function CatPawLogo({
  className = "",
  size = 38,
  pawId,
}: CatPawLogoProps) {
  const { lang } = useI18n();
  const [currentPawId, setCurrentPawId] = useState<string>(pawId || "3_calico_pink");

  useEffect(() => {
    if (pawId) {
      setCurrentPawId(pawId);
      return;
    }

    setCurrentPawId(getSavedCatPaw());

    const handlePawChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ pawId: string }>;
      if (customEvent.detail?.pawId) {
        setCurrentPawId(customEvent.detail.pawId);
      }
    };

    window.addEventListener("xc_cat_paw_changed", handlePawChange);
    return () => {
      window.removeEventListener("xc_cat_paw_changed", handlePawChange);
    };
  }, [pawId]);

  const paw =
    CAT_PAW_PRESETS.find((p) => p.id === currentPawId) ||
    CAT_PAW_PRESETS.find((p) => p.id === "3_calico_pink") ||
    CAT_PAW_PRESETS[0];

  const pawName = lang === "en" ? paw.nameEn || paw.name : paw.name;
  const pawDesc = lang === "en" ? paw.descEn || paw.desc : paw.desc;

  return (
    <img
      src={paw.src}
      alt={pawName}
      width={size}
      height={size}
      style={{ width: `${size}px`, height: `${size}px` }}
      className={`object-contain flex-shrink-0 select-none transition-transform duration-300 hover:scale-110 active:scale-95 cursor-pointer drop-shadow-sm ${className}`}
      draggable={false}
      title={`${pawName} - ${pawDesc}`}
    />
  );
}
