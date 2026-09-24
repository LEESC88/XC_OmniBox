# XC_OmniBox (XC 万象箱)

<p align="center">
  <strong>全能多媒体创作效率桌面客户端 / All-in-One Multimedia & Productivity Desktop Toolbox</strong>
</p>

<p align="center">
  <a href="https://github.com/LEESC88/XC_OmniBox/releases/latest">
    <img src="https://img.shields.io/github/v/release/LEESC88/XC_OmniBox?style=flat-square&color=ff6b00" alt="Release" />
  </a>
  <a href="https://github.com/LEESC88/XC_OmniBox/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20x64-lightgrey?style=flat-square" alt="Platform" />
</p>

---

## 📖 简介 / Introduction

**XC_OmniBox** 是一款基于 Electron + Next.js (React) + FastAPI (Python 引擎) 构建的现代化全能桌面工具箱。致力于提供**纯本地运行、隐私安全、无云端上传限制、极速轻量**的一站式多媒体与文档处理体验。

---

## ✨ 核心功能模块 / Features

### 📄 1. PDF 与文档处理 (Document Tools)
- **Word 转 PDF (超清/多档位)**：支持轻量 (96 DPI)、标准 (150 DPI)、超清打印级 (300 DPI) 三档导出；独创**智能字体流裁剪**算法，彻底杜绝包含 Emoji / 特殊字形时的无谓体积膨胀。
- **PDF 转 Word (高保真还原)**：深度解析排版布局、表格结构与公式。
- **PDF 合并与拆分**：多文档拖拽排序快速合并，按页码范围自定义提取。
- **PDF 页面编辑与加解密**：支持原位图层编辑、半透明防伪水印添加、AES 高强度密码保护。

### 🖼️ 2. 图像处理与智能工具 (Image Tools)
- **智能图片无损压缩**：媲美 TinyPNG 的视觉无损压缩算法，最高节省 90% 存储。
- **Apple HEIC 转码**：一键将 iPhone 实况照片/HEIC 转换为通用 JPG/PNG。
- **全格式图片互转**：支持 WebP、PNG、JPG、BMP、TIFF 等主流格式互相转换。
- **证件照智能排版**：标准一寸、二寸证件照自动背景生成与打印排版。

### 🎬 3. 音视频工作流 (Audio & Video Tools)
- **视频转 GIF**：截取任意视频片段，自定义帧率与分辨率生成高质量动图。
- **视频提取音频 / 格式转换**：极速无损分离背景音乐与人声音轨。

### 🌐 4. 国际化与用户体验 (UI & Experience)
- **完整双语支持**：内置中文与英文一键无缝热切换（包含所有设置、提示、错误信息）。
- **完全本地化处理**：所有文件计算均在本地运行，数据不出本机，保障隐私。
- **深色沉浸式设计**：流畅动画与现代磨砂玻璃质感 UI。

---

## 🚀 快速开始 / Download & Install

### 下载预编译安装包 (推荐)
直接前往 [GitHub Releases](https://github.com/LEESC88/XC_OmniBox/releases/latest) 下载最新的 Windows 64 位安装程序：
- `XC_OmniBox-Setup-1.0.0.exe`

---

## 🛠️ 本地开发环境搭建 / Development Setup

### 前置要求
- Node.js 18+ & npm
- Python 3.11+
- Windows 10 / 11

### 1. 克隆代码仓库
```bash
git clone https://github.com/LEESC88/XC_OmniBox.git
cd XC_OmniBox
```

### 2. 安装前端与 Electron 依赖
```bash
npm install
npm --prefix frontend install
```

### 3. 配置 Python 后端环境
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 4. 运行开发环境
```bash
npm run dev:electron
```

### 5. 打包构建
```bash
# 完整全量打包 (构建前端 + 编译 Python 二进制 + 打包 NSIS 安装包)
npm run dist

# 仅前端与 Electron 快速更新打包
npm run dist:fast
```

---

## 📜 开源协议 / License

本项目基于 [MIT License](LICENSE) 开源。
