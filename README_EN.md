# XC_OmniBox

<p align="center">
  <strong>Fast Local Offline Multimedia & Dev Toolbox</strong>
</p>

<p align="center">
  <strong>English</strong> | <a href="README.md">简体中文</a> | <a href="USER_MANUAL_EN.md"><strong>📖 User Manual</strong></a>
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
</p>

---

## 📖 Introduction

**XC_OmniBox** is a modern, high-performance desktop productivity and multimedia toolbox built with Electron, Next.js (React), and FastAPI (Python hybrid engine). Designed from the ground up for privacy-conscious developers, content creators, and office professionals, XC_OmniBox guarantees **100% local offline processing, zero cloud data transfer, zero vendor lock-in, and instant latency-free responsiveness**.

---

## 🌟 What's New in v1.5.1

- 📊 **Brand New Spreadsheet Studio**:
  - **Sheet Merge**: Drag and drop multiple Excel / CSV workbooks. Automatically identifies header columns, filters empty rows, deduplicates, appends source origin tags, and exports consolidated spreadsheets.
  - **Sheet Split**: Upload large master spreadsheets and automatically split them by any chosen category column (e.g., Department, City, Product Type) into individual Excel workbooks packaged in a single ZIP download.
- 🗂️ **Smart File Organizer**:
  - Purpose-built for cluttered Desktop and Downloads folders. Automatically categorizes files by **format type** (Documents, Images, Videos, Audio, Archives, Installers, Code), **chronological timeline** (`YYYY/MM`), and isolates corrupted **0KB empty files**.
  - **Dry-Run Preview**: Inspect planned relative destinations, category summaries, and file size statistics before performing any actual disk move. Auto-appends sequence numbers to prevent overwrite collisions, with web ZIP export fallback.
- ⚡ **Fast Duplicate Cleaner**:
  - Benchmarks the industry-leading `czkawka` architecture with a **Tiered Short-Circuit Hashing Engine** (Level 1: File size clustering $\to$ Level 2: Head 4KB partial fingerprint $\to$ Level 3: Full SHA-256/MD5 hash confirmation) to minimize disk I/O.
  - Intelligently tags originals and replicas with 1-click batch safe removal to the **Windows OS Recycle Bin**, completely preventing accidental permanent data loss with full restore support.
- 🛠️ **Hardened Cross-Process IPC Pipeline**:
  - Standardized IPC contracts between Electron main process and renderer for directory scanning, batch atomic renaming, and recycle bin operations.

---

## 🌟 What's New in v1.5.0

- 🎨 **Enterprise UI/UX Design System Overhaul**:
  - Comprehensive aesthetic refresh across all toolboxes featuring Squircle duotone icons, microchip parameter badges, radial ambient glow dropzones, and precision sliders.
  - Visual and haptic refinement across Interactive PDF Editor, Image Studio, Audio Studio, and Daily Utilities.

---

## 🌟 What's New in v1.4.1

- 📑 **Document Studio Horizontal Scrollable Tab Bar**:
  - Added the top horizontal sub-feature tab bar to the Document & PDF workbench, offering 1-click navigation across all 10 document sub-tools.
  - Aligns 100% with Image, Audio, Daily, and AI studios with mouse wheel horizontal scrolling, drag-to-scroll gestures, micro-scrollbar, and pagination arrows.

---

## 🌟 What's New in v1.4.0

- ⚡ **Sub-Second Cold Boot (300ms UI Presentation)**:
  - Re-architected main process startup from synchronous blocking to concurrent asynchronous initialization, launching the UI window in under 300 milliseconds.
  - Python hybrid runtime boots concurrently in the background with progressive soft retries, delivering a 10x perceived launch speedup.
- 🚀 **Keep-Alive Architecture with 0ms Tool Switching**:
  - All core studios (Document, Image, Audio, Daily Utilities, AI Studio) now run in persistent Keep-Alive containers, completely eliminating DOM tear-down and GC stutters.
  - 120 FPS buttery-smooth tool switching that preserves active files, preview canvases, and configuration states across sessions.

---

## 🌟 What's New in v1.3.2

- 📖 **Official User Manual Released**:
  - Comprehensive bilingual documentation [`USER_MANUAL.md`](USER_MANUAL.md) / [`USER_MANUAL_EN.md`](USER_MANUAL_EN.md) detailing quick start, core studio guides, shortcuts cheatsheet, and troubleshooting.
- 🌐 **External Links Route Directly to System Browser**:
  - All web links (GitHub repository, user manual, release notes) automatically open in the user's default external browser (Chrome, Edge, etc.) rather than an internal Electron window.
- 🔄 **Dynamic Version Sync & Clean Description**:
  - The settings about panel dynamically reads the actual running application version.
  - Simplified and refined about panel descriptions for a clean, understated aesthetic.

---

## 🌟 What's New in v1.3.1

- 🧹 **Module Streamlining & Clutter Removal**:
  - Completely excised the redundant "Finance & Everyday Utils" tab (removing miscellaneous RMB capitalization, word statistics, ID card validator, and JSON/Base64/Hash/Timestamp helpers).
  - The Everyday Utilities studio is now laser-focused on its 3 flagship, high-value tools: **ID Photo Studio & Print Layout**, **Artistic QR Code Generator & Scanner**, and **Article & Text Diff Engine**.

---

## 🌟 What's New in v1.3.0

- 🏎️ **Full-Stack 60~120 FPS Fluid Performance Engine**:
  - **Chromium GPU Hardware Acceleration**: Unleashed `--enable-gpu-rasterization` and `--enable-zero-copy` flags. UI vector icons and high-resolution images upload straight into GPU VRAM, bypassing Intel/AMD integrated graphics driver blacklists.
  - **Out-of-Process 2D Canvas Acceleration**: Watermark stamping, Squoosh-style micro-contrast inspection, ID photo layout, and brush selection renders are fully processed on dedicated GPU shaders, eliminating CPU frame drops.
- ⚡ **DOM Virtualization & Composited Layers**:
  - Integrated `content-visibility: auto` viewport clipping for batch processing queues. Task lists with 50~200+ concurrent jobs achieve 400%+ rendering throughput by skipping offscreen layout passes.
  - Upgraded modal dialogs (Shortcuts Guide, Preferences, Squoosh Compare) and floating action bars to dedicated GPU composite layers via `translate3d` hardware transforms.
- 🧊 **React 18 Non-Blocking Concurrent Transitions**:
  - Module navigation wrapped with `React.startTransition`. Sidebar buttons provide instant 0ms touch feedback while complex component trees render asynchronously in background threads.
- 🎯 **RAF 60/120/144Hz VSync Rate Throttling**:
  - Image quality comparison slider and zoom/pan gestures are throttled to `requestAnimationFrame`, strictly aligned with high-refresh display monitors and high-polling-rate gaming mice.

---

## 🌟 What's New in v1.2.0

- ⚡ **Global Productivity Shortcuts & Smart Clipboard**:
  - Key shortcuts: `Ctrl + Enter` (Run current operation), `Ctrl + S` (Quick save/download generated result, intercepts browser save dialog), `Ctrl + 1~5` (Switch between the 5 primary modules instantly), `Ctrl + ,` (Preferences), `Ctrl + /` (Toggle shortcuts cheat sheet).
  - Global Smart Clipboard (`Ctrl + V`): Paste copied images anywhere to automatically route into Image Studio, AI Studio, or ID Photo Studio; paste text directly into Article Diff.
- 🔗 **Zero-Copy Tool Chaining & Data Pipeline**:
  - Eliminates workflow silos with an in-memory `toolBus`. Every output card features a **"Send to..."** action menu.
  - Seamlessly pipe AI Cutouts $\to$ ID Photos/Image Compression, Audio/Video Subtitles $\to$ Article Diff, Video Audio Extraction $\to$ Audio Trimmer/Transcoder/Karaoke without redundant disk I/O.
- 🛡️ **Python Backend Self-Healing Supervisor**:
  - Native Electron process supervisor with automatic health probing and crash recovery (exponential backoff up to 5 attempts).
  - Frontend `apiFetch` interceptor automatically triggers background revival and transparently retries interrupted network calls.
- 🚀 **Batch Concurrency Pipeline & Squoosh Quality Comparison**:
  - Worker concurrency pool (4 workers), pause/cancel/retry controls, overall progress bar with remaining time estimation (ETA), and one-click ZIP packaging.
  - Squoosh-style interactive split-screen quality comparison slider.

---

## 🌟 What's New in v1.1.0

- 🤖 **All-New AI Magic Studio Extensions**:
  - **AI Inpaint Brush**: Powered by IOPaint C++ Telea and Navier-Stokes dual algorithms. Interactively brush over watermarks, scratches, and unwanted elements with real-time sliding comparison (Squoosh-style).
  - **Dual-Layer Searchable PDF Maker**: Integrates Umi-OCR and Tesseract to transform scanned images into dual-layer PDFs that preserve high-fidelity visual layouts while embedding invisible selectable/searchable text layers.
  - **Audio & Video Subtitle Studio**: Built-in Buzz Web Audio Voice Activity Detection (VAD) for speech segmentation and millisecond-accurate timestamp alignment. Export subtitles in industry-standard SRT, VTT, and plain TXT formats.
- 📝 **Article & Text Diff Tool**: Dual-pane text revision comparison with paragraph and character-level diff highlighting, bilingual English/Chinese presets, fold-unchanged view, and addition/deletion statistics.
- 🎨 **Independent Dual-Theme Architecture (White & Dark)**: Streamlined into pure **White (Light)** and **Dark (Deep Slate)** modes. Custom color recipes (Canvas, Surface, Accent, Text, Border) are stored independently per mode, ensuring mode toggles never wipe personalized styling.
- 🔤 **High-Clarity English Typography**: 5 standard system UI fonts (System Default, Inter, Roboto, Segoe UI, Monospace) with standardized live English typography preview banners.
- 🛡️ **Defensive Settings Workflow (Draft/Commit)**: Live preview without unintended persistence; prompt warning dialog if attempting to exit with unsaved modifications.
- 📴 **100% Offline Privacy Guarantee**: Entire workflow runs locally without external network requests or third-party telemetry.

---

## ✨ Features Matrix

### 📄 1. Document & PDF Studio
- **1:1 In-Place PDF Editor**: In-situ text editing, paragraph modifications, masking, and annotations while strictly locking original page layout.
- **Word to PDF Converter**: Light (96 DPI), Standard (150 DPI), and Print-grade (300 DPI) presets with font subset stream-pruning to eliminate file bloat.
- **PDF to Word Conversion**: High-fidelity reconstruction of layouts, tables, and typography.
- **PDF Utilities**: Drag-and-drop merging, page-range extraction, semi-transparent watermark injection, and AES password protection.

### 🖼️ 2. Image & Visual Studio
- **Lossless Image Compression**: Perceptual lossless compression reducing file size by up to 90% without visible degradation.
- **Apple HEIC/Live Photo Transcoder**: Fast conversion of iPhone HEIC photos into standard JPG, PNG, or WebP.
- **Universal Format Transcoding**: Batch processing across WebP, PNG, JPG, BMP, TIFF, and AVIF.
- **EXIF Privacy Stripper**: Remove GPS coordinates, camera serials, and device metadata with one click.

### 🎵 3. Audio & Acoustic Studio
- **Lossless Audio Transcoder**: High-throughput conversion between MP3, WAV, FLAC, AAC, OGG, and M4A.
- **Mastering-Grade Resampling**: Configurable sample rates (44.1 kHz to 96 kHz), bit depths (16-bit, 24-bit, 32-bit float), and channel modes.
- **Speed & Pitch Shifting**: Adjust playback tempo and frequency pitch independently.
- **Acoustic Waveform Generator**: Generate calibrated sine, square, pink noise, and white noise with real-time waveform visualizers.

### 🤖 4. AI Magic Studio
- **AI Inpaint Brush**: Local C++ restoration for removing photo defects, watermarks, and bystanders.
- **Searchable PDF Maker**: Convert image-only scans into searchable, selectable text PDFs.
- **Subtitle Alignment Studio**: Local Voice Activity Detection (VAD) generating SRT / VTT subtitle files.
- **Hair-Level Portrait Cutout**: Fast background removal for portraits and product photos.
- **AI Super-Resolution**: Texture upscaling and detail restoration.

### 🛠️ 5. Everyday & Developer Utilities
- **Article & Text Diff**: Side-by-side article revision diffing with bilingual samples.
- **ID Photo Layout**: Standard 1-inch and 2-inch background replacements (Red/White/Blue/Gray) with 6-inch photo print tiling.
- **Artistic QR Code Generator**: Gradient palettes, embedded center logo, WiFi/vCard generation, and offline scanning.
- **Finance & Dev Tools**: Chinese RMB financial uppercase conversion, word/character counter, JSON validator, and Base64/Hash encoders.

---

## 🚀 Download & Installation

### Windows Installer (x64)
Download the latest Windows installer directly from [GitHub Releases](https://github.com/LEESC88/XC_OmniBox/releases/latest):
- **`XC_OmniBox-Setup-1.2.0.exe`**

---

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+ & npm
- Python 3.11+
- Windows 10 / 11

### 1. Clone the Repository
```bash
git clone https://github.com/LEESC88/XC_OmniBox.git
cd XC_OmniBox
```

### 2. Install Dependencies
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
# Full desktop application (Frontend + Backend + Electron host)
npm run dev:electron

# Browser-only development (http://localhost:3000)
npm run dev
```

### 5. Build Distribution
```bash
# Compile frontend static export
npm run build:frontend

# Package standalone Windows NSIS installer
npm run dist
```

---

## 📜 License

This project is licensed under the [MIT License](LICENSE).
