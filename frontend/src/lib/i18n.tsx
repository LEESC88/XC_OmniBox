"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Language = "zh" | "en";

// 工具词条动态英文化投影字典（纯映射表，绝不复制整体工具对象和逻辑）
export const TOOL_TRANSLATIONS: Record<
  string,
  { name: string; desc: string; badge?: string }
> = {
  // Document
  "pdf-edit": {
    name: "In-Place PDF Editor",
    desc: "1:1 layout typography and in-place layer editing",
    badge: "Word-like",
  },
  "pdf-to-word": {
    name: "PDF to Word (Reverse)",
    desc: "High-fidelity extraction of tables and formatted layouts",
    badge: "Recommended",
  },
  "word-to-pdf": {
    name: "Word to Ultra PDF",
    desc: "Print-grade lossless vector rendering with 300+ DPI fidelity",
    badge: "300DPI",
  },
  "pdf-merge": {
    name: "Merge PDF Documents",
    desc: "Sort, combine, and merge multiple PDFs seamlessly",
    badge: "Multi-select",
  },
  "pdf-split": {
    name: "Split & Extract PDF",
    desc: "Extract pages by custom range or individual slices",
    badge: "Range",
  },
  "pdf-watermark": {
    name: "PDF Stamp & Watermark",
    desc: "Anti-counterfeit translucent custom text watermark",
    badge: "Watermark",
  },
  "pdf-protect": {
    name: "PDF Password Protection",
    desc: "High-grade AES encryption to restrict viewing & printing",
    badge: "Security",
  },

  // Image
  "compress": {
    name: "Smart Image Compressor",
    desc: "TinyPNG-grade visual lossless image compression",
    badge: "Save 90%",
  },
  "heic": {
    name: "Apple HEIC Converter",
    desc: "Convert iPhone live photos and HEIC to JPEG/PNG instantly",
    badge: "Apple",
  },
  "convert": {
    name: "Universal Image Convert",
    desc: "Fast mutual conversion for WebP, JPG, PNG, and ICO",
    badge: "All Formats",
  },
  "resize": {
    name: "Precision Resize",
    desc: "Smart cropping for ID photos, social media, and wallpapers",
    badge: "Presets",
  },
  "exif": {
    name: "EXIF Privacy Scrubber",
    desc: "Strip GPS location, camera model, and private metadata",
    badge: "Anti-leak",
  },
  "watermark": {
    name: "Batch Image Watermark",
    desc: "Tile custom text or brand logos to protect copyright",
    badge: "Copyright",
  },

  // Audio
  "trim": {
    name: "Lossless Audio Cutter",
    desc: "Millisecond-precise waveform trimming and ringtone maker",
    badge: "Waveform",
  },
  "convert-audio": {
    name: "Audio Format Transcoder",
    desc: "High bitrate conversion for MP3, WAV, FLAC, AAC, OGG",
    badge: "320K",
  },
  "merge-audio": {
    name: "Seamless Audio Joiner",
    desc: "Combine multiple audio tracks in sequential sequence",
    badge: "Mashup",
  },
  "extract": {
    name: "Video Audio Extractor",
    desc: "Extract pristine MP3 soundtrack from MP4 / MKV videos",
    badge: "Fast Extract",
  },
  "volume": {
    name: "Audio Volume Booster",
    desc: "0% ~ 300% dynamic lossless gain with anti-clipping",
    badge: "Gain",
  },

  // Utilities
  "idphoto": {
    name: "ID Photo Background",
    desc: "Smart red/white/blue background replacement and 6-inch layout",
    badge: "6-inch Print",
  },
  "qrcode": {
    name: "Artistic QR Generator",
    desc: "Gradient colors, custom styles, and embedded center logo",
    badge: "Logo",
  },
  "diff": {
    name: "Dual-Pane Text Diff",
    desc: "Real-time diff highlighting and character-level comparison",
    badge: "Dual Pane",
  },
  "dev": {
    name: "Developer Toolkit",
    desc: "JSON validator, Base64, hashing, timestamp converter",
    badge: "Swiss Knife",
  },

  // AI
  "ai-bg-remove": {
    name: "AI Hair-Level Cutout",
    desc: "Pixel-perfect portrait cutout with complex backgrounds",
    badge: "AI Cutout",
  },
  "ai-ocr": {
    name: "AI Text Extraction (OCR)",
    desc: "High-accuracy text recognition for documents, books, and receipts",
    badge: "Multi-lang",
  },
  "ai-upscale": {
    name: "AI Image Upscaler",
    desc: "2x / 4x super-resolution reconstruction and edge sharpening",
    badge: "Super-Res",
  },
};

export const CATEGORY_TRANSLATIONS: Record<string, string> = {
  document: "Document & PDF",
  image: "Image & Visual",
  audio: "Audio & Sound",
  utilities: "Utility & Dev",
  ai: "AI Magic Studio",
};

// UI 通用完整字典
export const UI_DICTIONARY = {
  zh: {
    windowTitle: "XC_OmniBox (XC 万象箱) - 椰林质感全能在线工坊",
    workspace: "工作台",
    appName: "XC 万象箱",
    appSubname: "轻量多媒体工作台",
    searchPlaceholder: "输入关键字搜索工具或功能...",
    noResults: "未找到相关工具",

    modules: {
      document: "文档",
      image: "图片",
      audio: "音频",
      utilities: "日常",
      ai: "AI工坊",
    },

    sidebar: {
      subTitle: "轻量多媒体工作台",
      preferences: "偏好与系统设置",
      preferencesSub: "托盘 / 自启 / 存储 / 引擎",
      darkAppearance: "曜黑暗夜模式",
      lightAppearance: "暖椰润肤模式",
      updateCenter: "软件更新中心",
      checkUpdate: "检查软件版本与更新",
      totalTools: "共 {n} 项工具",
    },

    pdfEdit: {
      title: "PDF 1:1 原版排版在线工作台",
      desc: "拖入需要就地修改的 PDF 文件，即可进入原位文字改字、遮盖涂抹与新增段落模式，完全锁定原版排版不跑偏。",
      dropzoneTitle: "拖入待编辑的 PDF 文件，点击即可进入在线工作台",
      dropzoneHint: "支持标准 PDF 文档",
      launchBtn: "进入在线 Word 级编辑工作台",
      parsing: "正在解析 PDF 排版与图层字形...",
    },

    pdfMerge: {
      title: "多文件批量选择合并",
      desc: "支持选中多个 PDF 批量上传，系统将自动读取首页缩略图预览，支持自由上下移动调序、追加文件后一键无损拼合。",
      dropzoneTitle: "拖入多个 PDF 文件（按 Ctrl 多选），或点击选择",
      dropzoneHint: "支持选中多个 PDF 批量合并",
    },

    pdfSplit: {
      title: "PDF 全文档可视化点选拆分",
      desc: "拖入 PDF 文档后自动生成整篇文档的页面缩略图网格，无需记忆输入页码，直接点击卡片即可多选抽取或拆分为单页压缩包。",
      dropzoneTitle: "拖入待拆分的 PDF 文档 (.pdf)，或点击选择",
      dropzoneHint: "支持标准 PDF 文档",
    },

    pdfWatermark: {
      title: "PDF 真实底图实时水印工作室",
      desc: "拖入 PDF 文档后自动加载真实页面底图，调节水印文字、透明度与旋转角度时右侧画面实时响应随动，所见即所得。",
      dropzoneTitle: "拖入待添加水印的 PDF 文档 (.pdf)，或点击选择",
      dropzoneHint: "支持标准 PDF 文档",
    },

    pdfProtect: {
      title: "加密权限设置",
      label: "设置访问查看密码",
      placeholder: "请输入加密密码",
      desc: "采用高强度加密算法，未输入正确密码者无法打开、阅读或打印文档。",
      dropzoneHeader: "投放待加密文档",
      dropzoneTitle: "拖入待加密的 PDF 文档 (.pdf)，或点击选择",
      dropzoneHint: "支持标准 PDF 文档",
      readyText: "加密成功已就绪",
      readyBadge: "✓ 就绪 · 点击下载",
      downloadNow: "立即下载该文件",
      encryptAnother: "加密新文件",
      processing: "正在加密中，请稍候...",
      launchBtn: "开始加密并导出受保护 PDF",
    },

    dropzone: {
      defaultTitle: "拖拽文件到此处，或点击上传",
      defaultHint: "支持相应格式文档",
      selectedFiles: "已选文件 ({n})",
      reselect: "重新选择",
    },

    updateModal: {
      title: "软件更新中心",
      currentVersion: "当前版本：v{version}",
      desktopNative: "(桌面原生端)",
      webOnline: "(在线网页端)",
      webNoticeTitle: "您当前使用的是在线网页版",
      webNoticeDesc: "桌面原生端已支持 Windows 一键安装与静默自动升级。您可以前往 GitHub 下载最新 Windows 安装包使用。",
      webNoticeBtn: "前往 Releases 页面下载安装包",
      idleNotice: "点击下方按钮检查是否有新版本发布。",
      checkBtn: "立即检查新版本",
      checking: "正在联网检查最新版本...",
      latestSuccess: "恭喜，当前已是最新版本！",
      latestSuccessDesc: "所有功能均已升级至最新状态。",
      newVersionFound: "发现新版本：v{version}！",
      newVersionDesc: "新版本包含功能升级与体验优化。点击下方按钮即可在后台高速静默下载。",
      downloadBtn: "立即下载更新包",
      downloading: "正在下载新版本安装包...",
      downloadNote: "下载完成后将自动提示您重启替换",
      readyTitle: "下载完成，随时可安装升级！",
      readyDesc: "点击下方按钮，软件将自动关闭、秒级完成文件覆盖，并重新启动进入最新版本。",
      restartBtn: "重启应用并完成升级",
      errorOccurred: "检查更新出现异常",
      retry: "重试一次",
      closeBtn: "关闭窗口",
    },

    settings: {
      title: "偏好设置",
      subtitle: "Settings",
      generalTab: "窗口与系统",
      filesTab: "文件与保存",
      appearanceTab: "外观与界面",
      engineTab: "核心引擎",
      aboutTab: "关于与更新",
      generalTitle: "窗口与系统行为",
      filesTitle: "文件处理与保存偏好",
      appearanceTitle: "外观与界面选项",
      engineTitle: "文档与处理引擎",
      aboutTitle: "关于万象箱与检查更新",
      autoSaved: "已自动保存",
      languageLabel: "界面显示语言 (Display Language)",
      languageDesc: "切换应用界面为简体中文或英文，即时生效",
      langZh: "🇨🇳 简体中文",
      langEn: "🇺🇸 English",

      // General
      minimizeTitle: "最小化行为（点击窗口右上角 “-” 按钮）",
      minimizeTray: "缩入托盘",
      minimizeTaskbar: "常规任务栏",
      minimizeDescTray: "当前：隐身缩小到任务栏右下角折叠区 (系统托盘待命)",
      minimizeDescTaskbar: "当前：缩小到常规任务栏 (传统 Windows 方式)",
      closeToTrayTitle: "关闭窗口时最小化至托盘后台待命（点击 “X” 按钮）",
      closeToTrayDesc: "开启后点击关闭不会直接退出软件，而是退至右下角随时秒级唤起",
      autoStartTitle: "开机自启动",
      autoStartDesc: "随 Windows 电脑开机自动在后台启动万象箱",

      // Files
      savePathTitle: "导出与保存路径配置",
      savePathCustomBadge: "已锁定自定义目录",
      savePathSystemBadge: "交互询问模式 (系统默认)",
      savePathCustomDesc: "文件将直接自动保存到您指定的下方文件夹中",
      savePathSystemDesc: "每次转换处理完成后由系统弹出窗口询问保存位置，默认起始定位如下",
      badgeCustom: "自定义",
      badgeSystem: "系统默认",
      changeFolder: "更改路径",
      openFolder: "打开目录",
      restoreDefault: "恢复默认",
      alertCustom: "所有处理生成的文件将直接自动输出保存至上述自定义目录。如需每次由系统询问选择保存路径，点击“恢复默认”即可。",
      alertSystem: "当前处于系统询问模式 (默认)。导出完成时系统将弹出保存对话框，方便您实时自定义文件名与保存位置。",
      openFolderAfterExportTitle: "导出完成后自动在文件夹中定位文件",
      openFolderAfterExportDesc: "文件生成下载完成后，自动唤起资源管理器高亮显示目标文件",
      cacheTitle: "临时缓存与空间清理",
      cacheDescPrefix: "当前临时文件缓存占用：",
      clearCacheBtn: "一键清理缓存",
      clearingCache: "清理中...",

      // Appearance
      pawSectionTitle: "萌宠肉球徽标 (Cat Paw Brand Avatar)",
      pawBadge: "4 款真实萌爪",
      pawDesc: "自定义左上角品牌猫爪形象，点击即时切换应用并持久保存",
      instantNotice: "即时生效",
      themeSectionTitle: "精选主题调色预设 (Theme Presets)",
      themeSectionDesc: "即点即切：包含 4 款浅色透亮明快 + 2 款沉稳曜黑暗色 (符合 WCAG AAA 清晰度)",
      myCustomTheme: "★ 我的专属配色",
      deleteCustomThemeTip: "删除已保存的专属配色",
      themeDark: "暗色",
      themeLight: "浅色",
      colorStudioTitle: "自定义调色工坊 (Color Studio)",
      tuningBadge: "调色中",
      customBadge: "专属已应用",
      canvasBg: "柔暖背景底色 (Canvas Background)",
      canvasBgDesc: "控制软件全屏底层画布色调",
      cardSurface: "纯净卡片表面 (Card Surface)",
      cardSurfaceDesc: "控制悬浮卡片、面板及侧边栏前景色",
      outlineBorder: "高清晰轮廓边线 (Outline Border)",
      outlineBorderDesc: "控制物理像素级清晰分割轮廓线条",
      textMain: "高对比度主字色 (Primary Text)",
      textMainDesc: "控制所有标题与主要段落的高对比文字色",
      textMuted: "温润辅助字色 (Muted Text)",
      textMutedDesc: "控制说明提示、页码及附属字样的颜色",
      accentHighlight: "焦点强调重点色 (Accent Brand)",
      accentHighlightDesc: "控制核心操作按钮、选中高亮与主题动态渐变光泽",
      saveCustomThemeBtn: "保存为专属配色",
      savedFeedback: "专属配色已锁定保存！",
      resetThemeBtn: "恢复默认配方",
      livePreviewTitle: "实时微缩预览效果 (Live Preview)",
      previewCardTitle: "XC OmniBox 调色预览",
      previewCardDesc: "背景、卡片与强调色实时同步联动已生效",
      testBtn: "测试按钮",
      fontSectionTitle: "界面字体偏好 (Custom Fonts)",
      fontBadge: "6 款 Windows 原生字系",
      fontDesc: "精心甄选 6 款风格差异鲜明的 Windows 原生预装字系，点击即刻全软件无死角换肤生效",

      // Engine
      engineTitleSection: "Word ↔ PDF 高保真互转引擎首选",
      engineAuto: "智能自适应检测 (推荐)",
      engineAutoDesc: "自动侦测本机 Microsoft Word COM 与 LibreOffice，选拔最高画质通道",
      engineCom: "原生 Windows Word COM 引擎",
      engineComDesc: "依托本机已安装的 Microsoft Office，300+ DPI 打印级无损矢量输出",
      engineLo: "LibreOffice 独立引擎",
      engineLoDesc: "开源跨平台解析核心，适合未安装正版 Office 的电脑",
      backendPortTitle: "后端专属服务端口",
      backendPortDesc: "当前监听端口：18520（专属安全独立通道，杜绝与 8000 端口冲突）",
      runningNormally: "正常运行中",

      // About
      autoCheckUpdateTitle: "启动时自动检查更新",
      autoCheckUpdateDesc: "每次启动应用时在后台静默检查 GitHub 官方版本，有新版时只在侧边栏亮起小红点",
      appVersionTitle: "XC OmniBox 桌面旗舰版",
      versionLabel: "当前版本: v1.0.0 · 椰林质感轻奢架构",
      checkUpdateBtn: "检查最新版本",
    },

    quality: {
      label: "输出质量档位",
      light: "轻量",
      standard: "标准",
      high: "高清",
      lightDpi: "96 DPI",
      standardDpi: "150 DPI",
      highDpi: "300 DPI",
      lightDesc: "文件最小",
      standardDesc: "平衡画质",
      highDesc: "打印级",
      lightSize: "~0.3-1 MB",
      standardSize: "~1-3 MB",
      highSize: "~3-8 MB",
    },

    common: {
      uploadHint: "拖入文件到此处，或点击选择",
      uploadWordHint: "拖入 Word 文档 (.docx, .doc)，或点击选择",
      uploadPdfHint: "拖入 PDF 文档 (.pdf)，或点击选择",
      startPage: "起始转换页码:",
      startPageHint: "（默认从第 1 页开始）",
      downloadNow: "立即下载该文件",
      convertAnother: "转换新文件",
      readyForDownload: "转换成功已就绪",
      readyBadge: "✓ 就绪 · 点击下载",
      startConvert: "开始执行转换任务",
      processing: "正在处理中，请稍候...",
      pleaseUpload: "请先上传需要处理的文件",
      errorOccurred: "处理过程出现异常",
      successNotice: "处理完成！请点击下方按钮下载保存",
      changeFile: "更换文件",
      total: "共",
      pages: "页",
      wordConversion: "Word 文档格式转换",
      wordDesc: "支持 .docx、.doc 格式，100% 打印级矢量超清渲染，公式与表格精准保留。",
      pdfConversion: "PDF 逆向格式转换 (.docx)",
      pdfDesc: "基于专业重构引擎，精准还原表格、文本排版与内嵌高清图片。",
      mergeAtLeastTwo: "合并至少需要选择 2 个 PDF 文件",
      mergeAtLeastTwoAlert: "合并至少需要 2 个 PDF 文件，请点击上方“追加更多 PDF”或继续拖入文件",
      enterPasswordFirst: "请输入要设置的密码",
      uploadSplitPdfFirst: "请先上传需要拆分的 PDF 文件",
      uploadWatermarkPdfFirst: "请先上传需要添加水印的 PDF 文件",
      watermarkSuccess: "水印添加成功！",
      splitSuccess: "拆分提取成功！",
      convertSuccess: "转换成功！",
      actionPdfToWord: "开始逆向转换为 Word (.docx)",
      actionWordToPdf: "开始转换为高保真超清 PDF",
      actionPdfMerge: "开始合并选中的 {n} 个 PDF 文件",
      actionPdfSplit: "开始提取并拆分 PDF",
      actionPdfWatermark: "开始添加文字水印并导出",
      actionPdfProtect: "开始加密并导出受保护 PDF",
      pdfPageCount: "共 {n} 页",
      pdfFormat: "PDF 格式",
      supportsWord: "支持 .docx 或 .doc 格式",
      supportsPdf: "支持标准 PDF 文档",
    },
  },
  en: {
    windowTitle: "XC_OmniBox Studio - All-in-One Creative Workshop",
    workspace: "Workspace",
    appName: "XC OmniBox",
    appSubname: "Creative Multimedia Studio",
    searchPlaceholder: "Type keywords to search tools...",
    noResults: "No tools found",

    modules: {
      document: "Document",
      image: "Image",
      audio: "Audio",
      utilities: "Utilities",
      ai: "AI Studio",
    },

    sidebar: {
      subTitle: "Creative Multimedia Studio",
      preferences: "Preferences & Settings",
      preferencesSub: "Tray / Startup / Storage / Engines",
      darkAppearance: "Dark Appearance Mode",
      lightAppearance: "Warm Light Appearance",
      updateCenter: "Software Update Center",
      checkUpdate: "Check for Updates",
      totalTools: "{n} tools in total",
    },

    pdfEdit: {
      title: "PDF 1:1 In-Place Typography Studio",
      desc: "Drag & drop PDF to edit text in-place, erase, or add paragraphs while preserving 100% layout fidelity.",
      dropzoneTitle: "Drag & drop PDF to edit, or click to browse",
      dropzoneHint: "Supports standard PDF documents",
      launchBtn: "Launch In-Place Word-Level Studio",
      parsing: "Analyzing PDF typography and layout...",
    },

    pdfMerge: {
      title: "Batch PDF Merge & Reorder",
      desc: "Upload multiple PDFs with instant thumbnail previews. Easily reorder, append, or reverse files for lossless one-click merging.",
      dropzoneTitle: "Drop multiple PDF files (Ctrl+click to select multiple), or click to browse",
      dropzoneHint: "Supports batch merging of multiple PDF files",
    },

    pdfSplit: {
      title: "Visual PDF Page Splitting & Extraction",
      desc: "Automatically generates visual page thumbnail grid. Click pages to select, extract ranges, or split into a single-page ZIP archive without remembering page numbers.",
      dropzoneTitle: "Drop PDF document (.pdf) to split, or click to browse",
      dropzoneHint: "Supports standard PDF documents",
    },

    pdfWatermark: {
      title: "Real-Time PDF Visual Watermark Studio",
      desc: "Loads real page backgrounds for instant WYSIWYG preview as you adjust text, opacity, size, and rotation angle.",
      dropzoneTitle: "Drop PDF document (.pdf) to watermark, or click to browse",
      dropzoneHint: "Supports standard PDF documents",
    },

    pdfProtect: {
      title: "Encryption Permissions & Security",
      label: "Set Access / Open Password",
      placeholder: "Enter encryption password",
      desc: "Uses high-strength encryption algorithms. Opening, reading, or printing requires the correct password.",
      dropzoneHeader: "Upload Document to Protect",
      dropzoneTitle: "Drop PDF document (.pdf) to encrypt, or click to browse",
      dropzoneHint: "Supports standard PDF documents",
      readyText: "Encrypted successfully & ready",
      readyBadge: "✓ Ready · Click to Download",
      downloadNow: "Download Encrypted File",
      encryptAnother: "Encrypt Another File",
      processing: "Encrypting document, please wait...",
      launchBtn: "Start Encryption & Export Protected PDF",
    },

    dropzone: {
      defaultTitle: "Drag and drop files here, or click to browse",
      defaultHint: "Supports corresponding document formats",
      selectedFiles: "Selected Files ({n})",
      reselect: "Reselect",
    },

    updateModal: {
      title: "Software Update Center",
      currentVersion: "Current Version: v{version}",
      desktopNative: "(Desktop Native)",
      webOnline: "(Web Browser)",
      webNoticeTitle: "You are running the Web Browser version",
      webNoticeDesc: "The Desktop Native edition supports Windows 1-click install and silent background auto-updates. Visit GitHub Releases to download.",
      webNoticeBtn: "Visit Releases page to download installer",
      idleNotice: "Click the button below to check if a newer version is available.",
      checkBtn: "Check for Updates Now",
      checking: "Checking for latest updates online...",
      latestSuccess: "Great, you are on the latest version!",
      latestSuccessDesc: "All modules and engines are up to date.",
      newVersionFound: "New Version Available: v{version}!",
      newVersionDesc: "This release includes new features and performance enhancements. Click below to download in background.",
      downloadBtn: "Download Update Now",
      downloading: "Downloading update package...",
      downloadNote: "You will be prompted to restart once the download finishes",
      readyTitle: "Update ready! Install whenever you are ready.",
      readyDesc: "Click below to close the app, apply files, and restart into the latest version.",
      restartBtn: "Restart App & Complete Update",
      errorOccurred: "An error occurred while checking for updates",
      retry: "Try Again",
      closeBtn: "Close Window",
    },

    settings: {
      title: "Preferences",
      subtitle: "Settings",
      generalTab: "Window & System",
      filesTab: "Files & Saving",
      appearanceTab: "Appearance & Theme",
      engineTab: "Core Engines",
      aboutTab: "About & Updates",
      generalTitle: "Window & System Preferences",
      filesTitle: "File Processing & Saving Options",
      appearanceTitle: "Theme, Fonts & Paw Styles",
      engineTitle: "Document & Processing Engines",
      aboutTitle: "About OmniBox & Software Updates",
      autoSaved: "Changes Saved",
      languageLabel: "Display Language",
      languageDesc: "Switch between Simplified Chinese and English instantly",
      langZh: "🇨🇳 Simplified Chinese",
      langEn: "🇺🇸 English",

      // General
      minimizeTitle: "Minimize Behavior (When clicking '-' button)",
      minimizeTray: "To System Tray",
      minimizeTaskbar: "Standard Taskbar",
      minimizeDescTray: "Current: Minimized to system tray area",
      minimizeDescTaskbar: "Current: Minimized to taskbar (Standard Windows way)",
      closeToTrayTitle: "Minimize to tray when closing window ('X')",
      closeToTrayDesc: "Keeps OmniBox running in the background for instant invocation",
      autoStartTitle: "Launch at Windows Startup",
      autoStartDesc: "Automatically run OmniBox in background when PC boots",

      // Files
      savePathTitle: "Export & Save Location Configuration",
      savePathCustomBadge: "Custom Path Locked",
      savePathSystemBadge: "Interactive Prompt (System Default)",
      savePathCustomDesc: "Files will be automatically saved directly into the custom folder below",
      savePathSystemDesc: "System will prompt for a save destination after each conversion",
      badgeCustom: "Custom",
      badgeSystem: "System Default",
      changeFolder: "Change Path",
      openFolder: "Open Folder",
      restoreDefault: "Restore Default",
      alertCustom: "All generated files will be saved directly into the designated custom folder above. To prompt for every file, click 'Restore Default'.",
      alertSystem: "Currently in Interactive Prompt mode. The save dialog will open pointing to your default Downloads folder for quick saving.",
      openFolderAfterExportTitle: "Reveal File in Folder After Export",
      openFolderAfterExportDesc: "Automatically open File Explorer and highlight exported file upon completion",
      cacheTitle: "Temporary Cache & Storage Cleaning",
      cacheDescPrefix: "Current temporary cache space used: ",
      clearCacheBtn: "Clear Cache Now",
      clearingCache: "Clearing...",

      // Appearance
      pawSectionTitle: "Brand Cat Paw Avatar (4 Real Breeds)",
      pawBadge: "4 Real Breeds",
      pawDesc: "Customize top-left brand mascot paw icon with instant persistent saving",
      instantNotice: "Instant Live",
      themeSectionTitle: "Curated Theme Presets (WCAG AAA High Contrast)",
      themeSectionDesc: "One-click switch: 4 bright light palettes + 2 sleek dark palettes",
      myCustomTheme: "★ My Custom Theme",
      deleteCustomThemeTip: "Delete saved custom theme",
      themeDark: "Dark",
      themeLight: "Light",
      colorStudioTitle: "Custom Palette Studio",
      tuningBadge: "Editing",
      customBadge: "Custom Applied",
      canvasBg: "Canvas Background Color",
      canvasBgDesc: "Controls the base full-screen application background",
      cardSurface: "Pure Card Surface",
      cardSurfaceDesc: "Controls floating cards, panels, and sidebar foreground",
      outlineBorder: "High-Contrast Outline Border",
      outlineBorderDesc: "Controls pixel-sharp dividing borders and outlines",
      textMain: "Primary Text Color",
      textMainDesc: "Controls high-contrast colors for all titles and primary copy",
      textMuted: "Muted Text Color",
      textMutedDesc: "Controls secondary labels, descriptions, and page counts",
      accentHighlight: "Accent Brand Color",
      accentHighlightDesc: "Controls primary action buttons, active tabs, and gradient glows",
      saveCustomThemeBtn: "Save as Custom Theme",
      savedFeedback: "Custom theme saved successfully!",
      resetThemeBtn: "Reset to Default Recipe",
      livePreviewTitle: "Live Studio Preview",
      previewCardTitle: "XC OmniBox Live Preview",
      previewCardDesc: "Background, cards, and accent colors synchronize in real-time",
      testBtn: "Test Button",
      fontSectionTitle: "Typography & Native Font Family",
      fontBadge: "6 Native Windows Fonts",
      fontDesc: "Carefully chosen 6 distinct Windows pre-installed fonts for instant full-app restyling",

      // Engine
      engineTitleSection: "Word ↔ PDF Preferred Conversion Engine",
      engineAuto: "Auto Intelligent Detection (Recommended)",
      engineAutoDesc: "Automatically detects Microsoft Word COM & LibreOffice for best fidelity",
      engineCom: "Native Windows Word COM Engine",
      engineComDesc: "Utilizes installed Microsoft Office for 300+ DPI print-grade lossless vector rendering",
      engineLo: "LibreOffice Headless Engine",
      engineLoDesc: "Open-source cross-platform engine, ideal when Office is not installed",
      backendPortTitle: "Dedicated Backend Service Port",
      backendPortDesc: "Currently listening on port: 18520 (Secure isolated channel, avoiding port conflicts)",
      runningNormally: "Running Normally",

      // About
      autoCheckUpdateTitle: "Check for Updates on Startup",
      autoCheckUpdateDesc: "Silently checks for new GitHub releases on launch; shows a red dot on sidebar if available",
      appVersionTitle: "XC OmniBox Desktop Edition",
      versionLabel: "Current Version: v1.0.0 · Precision Native Architecture",
      checkUpdateBtn: "Check for Latest Version",
    },

    quality: {
      label: "Output Quality Level",
      light: "Lightweight",
      standard: "Standard",
      high: "High-Def",
      lightDpi: "96 DPI",
      standardDpi: "150 DPI",
      highDpi: "300 DPI",
      lightDesc: "Smallest Size",
      standardDesc: "Balanced Quality",
      highDesc: "Print Grade",
      lightSize: "~0.3-1 MB",
      standardSize: "~1-3 MB",
      highSize: "~3-8 MB",
    },

    common: {
      uploadHint: "Drag and drop files here, or click to browse",
      uploadWordHint: "Drag and drop Word files (.docx, .doc), or click to browse",
      uploadPdfHint: "Drag and drop PDF files (.pdf), or click to browse",
      startPage: "Start Page:",
      startPageHint: "(Defaults to page 1)",
      downloadNow: "Download Converted File",
      convertAnother: "Convert Another File",
      readyForDownload: "Ready for Download",
      readyBadge: "✓ Ready · Click to Download",
      startConvert: "Start Conversion Task",
      processing: "Processing, please wait...",
      pleaseUpload: "Please select or upload files first",
      errorOccurred: "An error occurred during processing",
      successNotice: "Processing complete! Click the button below to save your file",
      changeFile: "Change File",
      total: "Total",
      pages: "pages",
      wordConversion: "Word to PDF Conversion",
      wordDesc: "Supports .docx and .doc with 100% print-grade vector fidelity, preserving formulas and tables.",
      pdfConversion: "PDF to Word (.docx) Extraction",
      pdfDesc: "Reverse-engineers layout, accurately recovering tables, formatted text, and embedded images.",
      mergeAtLeastTwo: "At least 2 PDF files are required for merging",
      mergeAtLeastTwoAlert: "Merging requires at least 2 PDF files. Click 'Append More PDFs' or drag more files in.",
      enterPasswordFirst: "Please enter an encryption password",
      uploadSplitPdfFirst: "Please upload a PDF file to split first",
      uploadWatermarkPdfFirst: "Please upload a PDF file to watermark first",
      watermarkSuccess: "Watermark applied successfully!",
      splitSuccess: "Pages split & extracted successfully!",
      convertSuccess: "Conversion completed successfully!",
      actionPdfToWord: "Convert PDF to Word (.docx)",
      actionWordToPdf: "Convert Word to Ultra PDF",
      actionPdfMerge: "Merge {n} Selected PDF Files",
      actionPdfSplit: "Extract & Split PDF",
      actionPdfWatermark: "Apply Watermark & Export",
      actionPdfProtect: "Encrypt & Protect PDF",
      pdfPageCount: "{n} pages",
      pdfFormat: "PDF Format",
      supportsWord: "Supports .docx or .doc files",
      supportsPdf: "Supports standard PDF documents",
    },
  },
};

/**
 * 动态投影函数：绝不克隆双份清单！
 * 仅在运行时，将唯一的 TOOLS_REGISTRY 单一真理源动态映射成当前语言对应的视图。
 */
export function getLocalizedTools<T extends { category: string; module: string; tools: any[] }>(
  registry: T[],
  lang: Language
): T[] {
  if (lang === "zh") return registry;

  return registry.map((cat) => ({
    ...cat,
    category: CATEGORY_TRANSLATIONS[cat.module] || cat.category,
    tools: cat.tools.map((tool) => {
      const translation = TOOL_TRANSLATIONS[tool.id];
      if (!translation) return tool;
      return {
        ...tool,
        name: translation.name,
        desc: translation.desc,
        badge: translation.badge ?? tool.badge,
      };
    }),
  }));
}

// React Context 与 Hook
interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: typeof UI_DICTIONARY["zh"];
}

const I18nContext = createContext<I18nContextType>({
  lang: "zh",
  setLang: () => {},
  t: UI_DICTIONARY.zh,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>("zh");

  // 初始化加载语言偏好
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("xc_language") as Language;
        if (saved === "zh" || saved === "en") {
          setLangState(saved);
        } else if ((window as any).electronAPI?.getDesktopConfig) {
          (window as any).electronAPI.getDesktopConfig().then((cfg: any) => {
            if (cfg?.language === "zh" || cfg?.language === "en") {
              setLangState(cfg.language);
            }
          });
        }
      }
    } catch (_) {}
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("xc_language", newLang);
        if ((window as any).electronAPI?.setDesktopConfig) {
          (window as any).electronAPI.getDesktopConfig().then((cfg: any) => {
            (window as any).electronAPI.setDesktopConfig({
              ...(cfg || {}),
              language: newLang,
            });
          });
        }
      }
    } catch (_) {}
  };

  const t = UI_DICTIONARY[lang] || UI_DICTIONARY.zh;

  // 动态同步更新窗口标题
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.title = t.windowTitle;
    }
  }, [lang, t.windowTitle]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
