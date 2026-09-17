import React from "react";

interface CoconutLogoProps {
  className?: string;
  size?: number;
}

/**
 * 椰子主题高品质矢量图标 (Coconut Logo)
 * 结构：熟褐椰壳外沿 + 鲜嫩椰肉白圈 + 清冽椰水天光 + 翠绿棕榈嫩叶 + 落日金橘微光
 */
export default function CoconutLogo({ className = "", size = 36 }: CoconutLogoProps) {
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

        {/* 落日暖橘高光渐变 */}
        <linearGradient id="sunGlowGrad" x1="16" y1="8" x2="36" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FB923C" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#F43F5E" stopOpacity="0" />
        </linearGradient>

        {/* 柔和阴影滤镜 */}
        <filter id="coconutShadow" x="0" y="2" width="48" height="46" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#1C0E05" floodOpacity="0.25" />
        </filter>
      </defs>

      <g filter="url(#coconutShadow)">
        {/* 1. 外层热带棕榈嫩叶 (从椰子顶部破土斜出生长) */}
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

        {/* 2. 椰子外壳主圆体 (略微带自然椭圆) */}
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

        {/* 4. 椰子水中心微漾波光池 */}
        <circle cx="24" cy="26" r="8.5" fill="url(#coconutWaterGrad)" />

        {/* 椰水中的落日微光反射水花 */}
        <ellipse cx="21" cy="23" rx="3.5" ry="2" transform="rotate(-30 21 23)" fill="#FFFFFF" opacity="0.8" />
        <circle cx="27" cy="28" r="1.5" fill="#FFFFFF" opacity="0.6" />

        {/* 5. 椰壳三个特征萌点 (Coconut Eyes) */}
        <circle cx="23" cy="19" r="1.2" fill="#3D200E" opacity="0.75" />
        <circle cx="26" cy="20" r="1" fill="#3D200E" opacity="0.75" />
      </g>
    </svg>
  );
}
