import React from "react";

interface CoconutLogoProps {
  className?: string;
  size?: number;
  variant?: "default" | "settings";
}

/**
 * 椰子主题高品质矢量图标 (Coconut Logo)
 * 支持普通版 (default) 与 齿轮设置版 (settings)
 */
export default function CoconutLogo({
  className = "",
  size = 36,
  variant = "default",
}: CoconutLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`flex-shrink-0 select-none transition-transform duration-300 hover:scale-105 ${className}`}
    >
      <defs>
        {/* 熟褐椰壳外层渐变 */}
        <linearGradient id="coconutHuskGrad" x1="6" y1="12" x2="42" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#8C532B" />
          <stop offset="45%" stopColor="#5A341A" />
          <stop offset="100%" stopColor="#2E170A" />
        </linearGradient>

        {/* 鲜白椰肉层渐变 */}
        <linearGradient id="coconutMeatGrad" x1="10" y1="14" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#F8F4ED" />
          <stop offset="100%" stopColor="#E9DEC9" />
        </linearGradient>

        {/* 清冽椰子水内芯水漾渐变 (带热带暖阳金辉) */}
        <linearGradient id="coconutWaterGrad" x1="14" y1="18" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="50%" stopColor="#FDE68A" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.8" />
        </linearGradient>

        {/* 翠绿棕榈嫩叶渐变 */}
        <linearGradient id="palmLeafGrad" x1="28" y1="4" x2="44" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="60%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#15803D" />
        </linearGradient>

        {/* 柔和阴影滤镜 */}
        <filter id="coconutShadow" x="0" y="2" width="48" height="46" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#1C0E05" floodOpacity="0.25" />
        </filter>
      </defs>

      <g filter="url(#coconutShadow)">
        {/* 1. 外层热带棕榈嫩叶 */}
        <path
          d="M26 14C30 8 37 4 43 5C43 11 40 18 34 21C30 22 27 18 26 14Z"
          fill="url(#palmLeafGrad)"
        />
        <path
          d="M27 14C32 10 37 8 42 7"
          stroke="#86EFAC"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* 第二片伴生小叶片 */}
        <path
          d="M22 13C24 7 30 4 35 5C34 9 32 14 27 16C24 16 22 14 22 13Z"
          fill="url(#palmLeafGrad)"
          opacity="0.85"
        />

        {/* 2. 椰子外壳主圆体 */}
        <circle cx="23" cy="27" r="17" fill="url(#coconutHuskGrad)" />

        {/* 椰壳表面木质纤维微光斑与纹理 */}
        <ellipse cx="14" cy="20" rx="4" ry="7" transform="rotate(-25 14 20)" fill="white" opacity="0.12" />
        <path
          d="M12 36C15 41 27 43 33 37"
          stroke="#422514"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* 3. 内嵌剖面椰肉圈 (鲜白水嫩) */}
        <circle cx="24" cy="26" r="13" fill="url(#coconutMeatGrad)" />

        {/* 4. 椰子核心区：根据 variant 切换为波光水池或精密齿轮 */}
        {variant === "settings" ? (
          <g className="transition-transform duration-700 ease-in-out group-hover:rotate-180 origin-[24px_26px]">
            {/* 齿轮金黄底托 */}
            <circle cx="24" cy="26" r="9" fill="url(#coconutWaterGrad)" />
            {/* 8齿精细工业风齿轮 */}
            <path
              d="M24 19.5c.6 0 1 .4 1.1 1l.2.8c.6.2 1.1.5 1.6.9l.7-.4c.5-.3 1.1-.2 1.5.2l.9.9c.4.4.5 1 .2 1.5l-.4.7c.4.5.7 1 .9 1.6l.8.2c.6.1 1 .5 1 1.1v1.2c0 .6-.4 1-1 1.1l-.8.2c-.2.6-.5 1.1-.9 1.6l.4.7c.3.5.2 1.1-.2 1.5l-.9.9c-.4.4-1 .5-1.5.2l-.7-.4c-.5.4-1 .7-1.6.9l-.2.8c-.1.6-.5 1-1.1 1h-1.2c-.6 0-1-.4-1.1-1l-.2-.8c-.6-.2-1.1-.5-1.6-.9l-.7.4c-.5.3-1.1.2-1.5-.2l-.9-.9c-.4-.4-.5-1-.2-1.5l.4-.7c-.4-.5-.7-1-.9-1.6l-.8-.2c-.6-.1-1-.5-1-1.1v-1.2c0-.6.4-1 1-1.1l.8-.2c.2-.6.5-1.1.9-1.6l-.4-.7c-.3-.5-.2-1.1.2-1.5l.9-.9c.4-.4 1-.5 1.5-.2l.7.4c.5-.4 1-.7 1.6-.9l.2-.8c.1-.6.5-1 1.1-1h1.2z"
              fill="#7C2D12"
            />
            {/* 齿轮中心轴芯 */}
            <circle cx="24" cy="26" r="3" fill="#FFF7ED" />
            <circle cx="24" cy="26" r="1.6" fill="#7C2D12" />
          </g>
        ) : (
          <>
            {/* 椰子水中心微漾波光池 */}
            <circle cx="24" cy="26" r="8.5" fill="url(#coconutWaterGrad)" />
            {/* 椰水中的落日微光反射水花 */}
            <ellipse cx="21" cy="23" rx="3.5" ry="2" transform="rotate(-30 21 23)" fill="#FFFFFF" opacity="0.8" />
            <circle cx="27" cy="28" r="1.5" fill="#FFFFFF" opacity="0.6" />
          </>
        )}

        {/* 5. 椰壳三个特征萌点 (Coconut Eyes) */}
        <circle cx="23" cy="19" r="1.2" fill="#3D200E" opacity="0.75" />
        <circle cx="26" cy="20" r="1" fill="#3D200E" opacity="0.75" />
      </g>
    </svg>
  );
}
