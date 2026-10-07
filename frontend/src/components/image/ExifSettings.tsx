"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ExifSettings() {
  const { lang } = useI18n();

  return (
    <div className="p-5 sm:p-6 bg-palm-50/70 dark:bg-palm-950/20 border border-palm-200/70 dark:border-palm-900/60 rounded-2xl space-y-2.5 text-xs sm:text-sm">
      <div className="font-bold text-sm sm:text-base text-palm-900 dark:text-palm-300 flex items-center space-x-2">
        <ShieldCheck className="w-5 h-5 text-palm-600 dark:text-palm-400" />
        <span>{lang === "en" ? "Strip Location & Device Metadata" : "抹除拍摄定位与硬件元数据"}</span>
      </div>
      <p className="text-palm-800 dark:text-palm-300/90 leading-relaxed">
        {lang === "en" ? (
          <>
            Photos taken with phones or cameras typically contain <strong>EXIF metadata</strong>, including{" "}
            <strong>GPS coordinates</strong>, exact timestamps, device models, aperture and shutter speeds. This
            tool reconstructs the pixel stream purely in the browser to strip non-pixel metadata without{" "}
            <strong>any quality loss</strong>, safeguarding your privacy.
          </>
        ) : (
          <>
            手机或相机拍摄的照片通常包含 <strong>EXIF 元数据</strong>，包括
            <strong>拍摄地理位置 GPS 坐标</strong>、拍摄详细时间、设备型号与镜头光圈快门等。
            本工具通过纯前端重构像素流，在<strong>不降低清晰度</strong>的前提下完全剥离任何非像素元数据，保护您的隐私安全。
          </>
        )}
      </p>
    </div>
  );
}
