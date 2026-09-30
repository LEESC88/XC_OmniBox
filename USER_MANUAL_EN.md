# XC_OmniBox Official User Manual

Welcome to **XC_OmniBox**! This is a modern, high-performance desktop productivity and multimedia toolbox built for creators, office professionals, and developers.

Every single feature operates **100% locally offline**. Your files and personal data never leave your computer, ensuring zero cloud risk and complete functionality even without internet connectivity.

---

## Table of Contents

1. [Quick Start & Installation](#1-quick-start--installation)
2. [Interface Layout & Navigation](#2-interface-layout--navigation)
3. [Core Studio Walkthroughs](#3-core-studio-walkthroughs)
   - [Document Studio (PDF & Word)](#31-document-studio-pdf--word)
   - [Image Studio](#32-image-studio)
   - [Audio & Video Studio](#33-audio--video-studio)
   - [Everyday Utilities](#34-everyday-utilities)
   - [AI Magic Studio](#35-ai-magic-studio)
4. [Productivity Shortcuts](#4-productivity-shortcuts)
5. [Cross-Tool Zero-Copy Pipeline](#5-cross-tool-zero-copy-pipeline)
6. [Settings & Customization](#6-settings--customization)
7. [Frequently Asked Questions (FAQ)](#7-frequently-asked-questions-faq)

---

## 1. Quick Start & Installation

### 1.1 System Requirements
- **Operating System**: Windows 10 / Windows 11 (64-bit)
- **Memory (RAM)**: 4 GB minimum (8 GB+ recommended for large images and AI audio models)
- **Disk Space**: 1 GB free space (includes the bundled Python processing runtime)

### 1.2 Installation Steps
1. Navigate to [GitHub Releases](https://github.com/LEESC88/XC_OmniBox/releases) and download the latest `XC_OmniBox-Setup-x.x.x.exe`.
2. Run the installer to choose your installation directory and desktop shortcut preference.
3. If Windows SmartScreen shows a "Windows protected your PC" alert, click **"More info"** $\to$ **"Run anyway"** (common for open-source applications without costly enterprise signing certificates).
4. Launch the app directly. No account registration or proxy configuration is required.

---

## 2. Interface Layout & Navigation

- **Sidebar (Left)**:
  - Collapsible header with application status and branding.
  - Quick switches between the 5 studios: **Document**, **Image**, **Audio/Video**, **Everyday**, and **AI Studio**.
  - Footer provides **Update Notification**, **Shortcuts Sheet (Ctrl + /)**, and **Settings (Ctrl + ,)**.
- **Top Horizontal Tab Bar**:
  - Switch between sub-tools within each studio.
  - Supports horizontal mouse wheel scrolling, paging buttons, and direct clicking.
- **Main Workspace**:
  - Drag-and-drop dropzone supporting direct file dragging from Windows Explorer or `Ctrl + V` clipboard pasting.

---

## 3. Core Studio Walkthroughs

### 3.1 Document Studio (PDF & Word)
- **In-Place PDF Editor**: Visually edit text, insert images, and add annotations directly on PDF pages.
- **PDF to Word & Word to PDF**: Retains original fonts, tables, alignments, and vector quality without misalignment.
- **Merge & Split**: Drag to reorder pages and merge multiple PDFs; extract pages by range or odd/even numbers.
- **Watermark & Protection**: Apply customizable text watermarks (opacity, rotation, tiled grid) and 128/256-bit encryption.
- **Page Organization & Compression**: Rotate, reorder, delete individual pages, and compress embedded raster images.

### 3.2 Image Studio
- **Batch Smart Compression**:
  - Concurrent multi-worker queue pool (4 workers) with configurable compression quality and target size ceilings (e.g., limit to < 500 KB).
  - Retry/cancel individual tasks, real-time ETA calculation, and one-click ZIP batch export.
- **Squoosh-Style Split Screen Quality Inspection**:
  - Click **"Compare"** on any processed item to reveal an interactive slider.
  - Zoom up to 400% with smooth panning to visually verify compression details before exporting.
- **Batch Format Conversion**: Convert between JPG, PNG, WebP, AVIF, and BMP with automatic EXIF privacy stripping (removes GPS tags and camera metadata).

### 3.3 Audio & Video Studio
- **AI Subtitle Extraction (Whisper)**:
  - Offline local Whisper voice recognition engine directly transcribes speech from MP4, MKV, MP3, and WAV files into millisecond-accurate SRT/VTT subtitles or plain text.
- **Vocal & Accompaniment Separation (Karaoke)**:
  - Deep-learning audio separation model splits music tracks into clean vocals and studio-grade background instrumentals.
- **Audio Extraction & Transcoding**: Extract audio tracks from video files; transcode between MP3, WAV, AAC, FLAC, and M4A.
- **Audio Trimmer & Tuning**: Visual waveform editor to trim start/end points, amplify volume gain, and adjust playback speed.

### 3.4 Everyday Utilities
Streamlined and focused on the 3 highest-value daily productivity tools:

- **ID Photo Studio & Print Layout**:
  - Standard compliant presets (1-inch, 2-inch, passport, visa).
  - One-click intelligent background replacement (White, Red, Blue, Neutral Gray).
  - **6-Inch Print Sheet**: Automatically arranges multiple copies onto standard 6-inch photo paper for home or photo lab printing.
  - **Exact File Size Limiter**: Specify strict size ranges (e.g., 20 KB ~ 100 KB) required by government or examination portals.
- **Artistic QR Code Generator & Scanner**:
  - Generate QR codes for text, automatic Wi-Fi connection, or contact vCards.
  - Custom gradient color themes and center logo embedding.
  - **Offline QR Scanner**: Decode QR codes from local images or screenshots without internet access.
- **Article & Text Diff Engine**:
  - Side-by-side dual-pane text comparison for documents, articles, and code revisions.
  - Color-coded addition and deletion highlights with instant difference report copying.

### 3.5 AI Magic Studio
All machine learning inference is performed entirely on your local CPU/GPU:

- **Hair-Level AI Cutout**: Accurate object and portrait segmentation with transparent PNG export.
- **AI Inpaint Brush**: Brush away unwanted objects, bystanders, scratches, and watermarks with texture-aware neural inpainting.
- **Searchable PDF Maker**: Overlays a transparent searchable OCR text layer over scanned documents, enabling text selection, copying, and full-text search.

---

## 4. Productivity Shortcuts

XC_OmniBox features a global keyboard shortcut engine:

| Shortcut | Description |
| :--- | :--- |
| **`Ctrl + Enter`** | Trigger the primary action of the active tool (Start Conversion / Compress / Generate) |
| **`Ctrl + S`** | Instantly download/save the generated result (intercepts default browser save) |
| **`Ctrl + 1`** | Navigate to **Document Studio** |
| **`Ctrl + 2`** | Navigate to **Image Studio** |
| **`Ctrl + 3`** | Navigate to **Audio & Video Studio** |
| **`Ctrl + 4`** | Navigate to **Everyday Utilities** |
| **`Ctrl + 5`** | Navigate to **AI Magic Studio** |
| **`Ctrl + /`** | Open / Close the **Shortcuts Guide** cheat sheet |
| **`Ctrl + ,`** | Open **Settings / Preferences** |
| **`Ctrl + V`** | **Smart Clipboard**: Paste images or text anywhere to automatically route into the appropriate tool |
| **`Esc`** | Dismiss any open modal dialog or comparison overlay |

---

## 5. Cross-Tool Zero-Copy Pipeline

XC_OmniBox is equipped with an in-memory zero-copy data bus (`toolBus`). Output cards feature a **"Send to..."** action menu:

- **Workflow Example 1**:
  Remove background in AI Studio $\to$ Click "Send to ID Photo Studio" $\to$ Immediately format onto a 6-inch print sheet.
- **Workflow Example 2**:
  Extract subtitles in Audio Studio $\to$ Click "Send to Text Diff" $\to$ Proofread against the original manuscript.
- **Workflow Example 3**:
  Extract audio from video $\to$ Click "Send to Vocal Separation" $\to$ Create karaoke backing tracks instantly.

All piped data passes through memory `Blob` objects without writing redundant temporary files to disk.

---

## 6. Settings & Customization

Access preferences via the sidebar or `Ctrl + ,`:

- **Window & System**: Toggle minimize-to-tray and close-to-tray behaviors; manage auto-launch on startup.
- **Files & Storage**: Configure default export directory, auto-reveal exported files in Windows Explorer, and clean temporary cache.
- **Appearance & Themes**: Dark/Light mode switching, high-contrast color palettes, and custom UI system fonts.
- **About & Updates**: View current version, trigger update checks, and open the official GitHub repository and user manual in your default system browser (Chrome/Edge).

---

## 7. Frequently Asked Questions (FAQ)

### Q1: Does XC_OmniBox connect to the internet?
**Answer**: No. All conversions, compression algorithms, and AI models execute strictly offline on your computer. The only optional network call is checking for new releases via the GitHub API.

### Q2: Why does Windows SmartScreen display a warning on installation?
**Answer**: Open-source applications without a commercial code-signing certificate trigger a default SmartScreen notice. Click **"More info"** $\to$ **"Run anyway"**. The entire codebase is open-source on GitHub with zero telemetry or malware.

### Q3: What should I do if a batch task feels slow?
**Answer**: Versions 1.3.0 and above include full Chromium GPU hardware rasterization. During heavy AI workloads (such as Whisper or vocal isolation), close intensive background 3D games to allocate maximum GPU memory to the processing engine.

---

*XC_OmniBox is released under the MIT License. For bug reports or feature requests, visit [GitHub Issues](https://github.com/LEESC88/XC_OmniBox/issues).*
