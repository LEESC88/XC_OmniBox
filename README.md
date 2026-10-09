# XC_OmniBox

<p align="center">
  <strong>Fast Local-First Desktop Toolbox & Multimedia Creative Suite</strong>
</p>

<p align="center">
  <strong>English</strong> | <a href="README_ZH.md">简体中文</a> | <a href="USER_MANUAL.md">📖 User Manual</a> | <a href="CHANGELOG.md">📋 Changelog</a>
</p>

<p align="center">
  <a href="https://github.com/LEESC88/XC_OmniBox/releases/latest">
    <img src="https://img.shields.io/github/v/release/LEESC88/XC_OmniBox?style=flat-square&color=2563EB" alt="Release" />
  </a>
  <a href="https://github.com/LEESC88/XC_OmniBox/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20x64-lightgrey?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/privacy-100%25%20Offline-success?style=flat-square" alt="100% Offline" />
  <img src="https://img.shields.io/badge/stack-Electron%20%7C%20Next.js%20%7C%20FastAPI-7C3AED?style=flat-square" alt="Tech Stack" />
</p>

---

## 📖 Overview

**XC_OmniBox** is a high-performance desktop productivity and multimedia workstation built on a hybrid architecture combining **Electron**, **Next.js 14 (React 18)**, and an embedded **FastAPI (Python 3.11)** processing engine.

Tailored for creators, engineers, and everyday office professionals, XC_OmniBox is engineered with four core tenets:
- 🛡️ **100% Local-First Privacy**: Zero external telemetry, zero API key requirements, and zero remote server uploads. All processing takes place within an isolated local sandbox.
- ⚡ **Instant Responsiveness**: Built with in-memory zero-copy pipelines, GPU-accelerated canvas filters, and client-side Web Audio DSP for real-time live previewing.
- 🚀 **Sub-Second Cold Boot**: Windows launch and render in under 300ms, coupled with a 120 FPS Keep-Alive module architecture that preserves user workstates during seamless tool switching.
- 🗂️ **Comprehensive Multipurpose Studios**: Covers documents, images, audio, spreadsheets, everyday utilities, and offline AI tools under a unified enterprise UI.

---

## 🏗️ System Architecture

The following interactive architecture map was generated and verified using [Archify](https://github.com/tt-a1i/archify):

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/assets/architecture-dark.png" />
    <img src="docs/assets/architecture-light.png" alt="XC_OmniBox System Architecture" width="100%" />
  </picture>
</p>

<p align="center">
  <a href="docs/architecture.html"><strong>🔍 Explore Interactive Architecture Map (HTML)</strong></a>
</p>

### Architecture Breakdown

1. **Desktop Shell Layer (`Electron Host`)**:
   - Manages native OS windows, application lifecycle, and context isolation (`preload.js`).
   - Runs a self-healing process supervisor that spawns and monitors the local Python FastAPI microservice.
   - Integrates `electron-updater` for verified differential background updates via GitHub Releases.

2. **Frontend Presentation & Client DSP (`Next.js 14 + React 18`)**:
   - Modern tabbed studio navigation with squircle duotone iconography and responsive dark/light themes.
   - Client-side Web Audio API (`AudioContext`, `BiquadFilter`, `GainNode`) for zero-latency audio parameter previewing.
   - HTML5 Canvas 2D and Web Workers for real-time 4-way BFS flood-fill matting, text diffing, and image rendering.

3. **Embedded Python Microservice (`FastAPI + PyInstaller`)**:
   - Standalone frozen executable (`omni-backend.exe`) locked strictly to loopback `127.0.0.1:8000` with CORS origin verification.
   - Powers heavy document engines (**PyMuPDF / fitz**, **python-docx**, **pdf2docx**) for 300+ DPI fidelity conversions and in-place PDF editing.
   - Runs computer vision and OCR workloads via **OpenCV**, **Pillow**, and **Tesseract OCR**.

---

## ✨ Workspaces & Core Features

### 📄 1. Document & PDF Studio
- **In-Place Visual PDF Editor**: Direct inline text editing, annotations, redaction masks, signature stamps, and vector overlays without altering surrounding layout.
- **Bi-Directional Word / PDF Converter**: High-fidelity conversions with multi-tier resolution options (96, 150, 300+ DPI) and font-stream pruning.
- **Page Manager & Security**: Multi-document merge, range-based splitting, dynamic anti-counterfeit watermarks, and AES encryption.

### 🖼️ 2. Image & Visual Studio
- **Visual Lossless Compression**: Intelligent compression saving up to 90% disk space while retaining pristine visual quality with Squoosh-style split-screen comparison.
- **Apple HEIC Transcoding**: Batch converts iOS Live Photos and `.heic` images into universal formats (JPG, PNG, WebP) with memory storm defense.
- **Batch Resizer & Formatting**: Letterbox and crop padding preserving original aspect ratios; EXIF metadata cleaner for privacy protection.

### 📊 3. Spreadsheet Studio
- **Multi-Sheet Merger**: Intelligently combines multiple Excel/CSV files by matching header fields, deduplicating records, and appending source tags.
- **Categorical Column Splitter**: Splits monolithic datasets by any category into individual workbooks with automatic ZIP bundling.
- **Anti-OOM Safeguard**: High-cardinality pre-checks and adaptive multi-row header detection preventing browser freezing on massive tables.

### 🎵 4. Audio & Acoustic Studio
- **Precision Trimmer & Looper**: Waveform trimming with pointer capture handles and seamless loop previews.
- **Multi-Track Audio Stitcher**: Drag-and-drop audio queue with per-track pre-listen controls and batch stitching.
- **0%~300% Gain & Live A/B Preview**: Attenuates or amplifies volume with zero-latency instant A/B switching between original and processed audio.
- **Karaoke Vocal Remover**: Stereo phase-cancellation vocal removal with adjustable low-frequency bass preservation and mono channel defense.
- **Video Soundtrack Extractor**: Pulls uncompressed audio tracks from video files with one-click playhead timestamp snapping.

### 🗂️ 5. Daily & Desktop Utilities
- **Article & Text Diff**: Inline fluid text comparison with word-level change highlighting, statistical metrics, and theme adaptation.
- **ID Photo Studio**: Standardized passport/visa sizes (1-inch, 2-inch) with 4-way BFS flood-fill background replacement and 6-inch auto-typeset print sheets.
- **Artistic QR Code Generator & Decoder**: Customizable colors, logos, and rounded styles preserving 7×7 finder patterns; clipboard paste (`Ctrl+V`) for immediate decoding.
- **Smart Directory Organizer**: Sorts cluttered folders by file type or date hierarchy (`YYYY/MM/`) with collision-proof dry-run simulations.
- **Fast Duplicate Cleaner**: 3-stage short-circuit hashing engine with custom original designation and safe recycling bin disposal.

### 🤖 6. AI Creative Workshop
- **AI Inpaint Eraser**: Removes unwanted objects, text, and watermarks with Alpha channel protection for transparent PNGs.
- **Dual-Layer Searchable PDF**: Merges scanned visuals with invisible OCR text layers for full-text searchability.
- **Subtitle Sync & Splitter**: Web Audio Voice Activity Detection (VAD) automatically extracts speech segments and generates SRT/VTT files.

---

## 🚀 Download & Installation

### Prebuilt Desktop Installer (Windows x64)

Download the latest verified setup executable from [GitHub Releases](https://github.com/LEESC88/XC_OmniBox/releases/latest):
- **`XC_OmniBox-Setup-1.5.4.exe`**

*Automatic updates will prompt whenever a new release is published to GitHub.*

---

## 🛠️ Local Development & Build

### Prerequisites
- **Node.js** 18+ & **npm**
- **Python** 3.11+
- **Windows** 10 / 11

### 1. Clone Repository
```bash
git clone https://github.com/LEESC88/XC_OmniBox.git
cd XC_OmniBox
```

### 2. Install Frontend & Electron Dependencies
```bash
npm install
npm --prefix frontend install
```

### 3. Setup Python Backend Environment
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 4. Run Development Server
```bash
# Full Desktop Environment (Next.js + FastAPI + Electron Shell)
npm run dev:electron

# Browser-Only Web Mode (http://localhost:3000)
npm run dev
```

### 5. Build Distribution Packages
```bash
# Build frontend static artifacts
npm run build:frontend

# Build standalone Windows installer (.exe)
npm run dist
```

---

## 📋 Release Notes & Changelogs

Detailed release notes and historical upgrade logs are maintained separately:
- 🌐 [Full English Release History (CHANGELOG.md)](CHANGELOG.md)
- 🇨🇳 [中文详细版本更新日志 (CHANGELOG_ZH.md)](CHANGELOG_ZH.md)

---

## 📜 License

This project is licensed under the [MIT License](LICENSE). Contributions, bug reports, and pull requests are warmly welcomed!
