# 📋 Release History & Changelog

All notable updates and releases for **XC_OmniBox** will be documented in this file.

For the Chinese version, see [中文更新日志](CHANGELOG_ZH.md).

---

## 🌟 v1.5.4 Audio Studio UX Polish & AI Visual Edge-Case Fortification

- 🎵 **Audio Studio Comprehensive UX Optimization & Defensive Hardening**:
  - **Global Drag-and-Drop Restoration**: Added full `onDragOver`/`onDrop` event listeners to Audio Merge, Volume Adjust, Tempo/Speed, and Karaoke studios, preventing unwanted browser redirects and enabling drag-and-drop file appending.
  - **Audio Trim Pointer Capture & Smooth Loop**: Integrated pointer capture on waveform trimmer handles to prevent cursor slipping out of bounds; resolved premature cleanup closure in loop playback for seamless repetition.
  - **Audio Converter Granular Queue & Filtering**: Added single-item removal buttons to conversion queue cards; pre-filters non-audio formats with clear error guidance.
  - **Audio Merge Track Previews & State Guard**: Added individual preview play/pause controls for each queued audio track; disabled merging action with clear guide when fewer than 2 tracks are present.
  - **Video Audio Extractor Sync Markers & Mute Defense**: Pre-detects and blocks silent/audio-less video tracks; added one-click playhead timestamp snapping and synchronized video clip preview.
  - **Volume Adjust 0%-300% Range & Live A/B Comparison**: Expanded gain slider to 0%-300% (supporting attenuation and muting); added WAV/MP3 format picker; integrated instant zero-latency A/B preview comparing original and processed audio.
  - **Audio Speed Resampling Notice & Instant Preview**: Explicitly notes resampling pitch shift behavior; added zero-latency live preview for speed adjustments and reversed audio.
  - **Karaoke Vocal Remover Mono Blocking & Live Monitoring**: Detects and halts processing on mono tracks with informative notices; added real-time accompaniment preview with dynamic bass preservation control.
- 🤖 **AI Studio Critical Fixes & Algorithmic Upgrades**:
  - **Inpaint Canvas Coordinate Alignment & Alpha Channel Protection**: Eliminated letterbox coordinate offsets; introduced a physical cursor follower; preserved Alpha channels to prevent transparent PNG backgrounds turning black.
  - **Searchable Dual-Layer PDF Full-Color Fidelity**: Decoupled OCR grayscale preprocessing from the visible background image, preserving pristine original full-color quality; added cross-tool transfer support.
  - **Smart Matting BFS Edge Flood-Fill Algorithm**: Upgraded to 4-connectivity BFS boundary expansion, preventing light-colored clothing and dental details from accidental cut-out; unified background color switching state with export blobs.
  - **Subtitle Precision Playback Truncation**: Single-segment subtitle previews now automatically halt precisely at their end timestamps.

---

## 🌟 v1.5.3 Daily Utilities Deep Optimization & Dynamic Version Alignment

- 🗂️ **Daily Utilities Deep Optimization & Reliability Hardening**:
  - **Article Diff Layout Fix**: Resolved broken block wrapping in word-level granular text diffing; redesigned as natural inline flowing typography with seamless light/dark theme adaptation.
  - **ID Photo Adaptive Print & Flood-Fill Matt**: Automatically calculates grid rows/columns with guaranteed positive padding ($\ge$ 10px) to prevent overlap or canvas clipping; implemented 4-way BFS flood-fill protection for foreground highlights and white clothing; expanded feather slider to 1~30px with zero-division safeguard.
  - **QR Code Finder Pattern Preservation**: Guaranteed solid 7x7 corner modules even under dot and rounded styles to ensure 100% camera recognition; added clipboard image pasting (`Ctrl+V`) for immediate offline decoding.
  - **Smart File Organizer Collision Defense**: Added source/target parity checks to prevent repetitive re-organizing and endless `(1)` suffix appending; introduced safe mode for organizing root directory only while skipping system/shortcut files (`desktop.ini`, `Thumbs.db`, `.lnk`, `~$*`).
  - **Fast Duplicate Cleaner Custom Original Selection**: Added "Keep this as original" button on any duplicate replica to dynamically customize the retention target; added one-click actions to locate in Explorer or open with default applications.
- 🔄 **Global Version Alignment & Live Update Perception**:
  - Fixed hardcoded version display in the sidebar "Update Center" card; now fetches dynamically from the Electron runtime environment; aligned all core modules and manifests across the project to `v1.5.3`.

---

## 🌟 v1.5.2 In-Place PDF Editor, Hardened Image Pipeline & Anti-OOM Spreadsheet Studio

- 📑 **Document Studio Resilience & Precision Editing**:
  - **In-Place Visual PDF Editor Restored**: Fixed top-level viewport mounting, fully restoring in-place text search & redaction, highlight boxes, annotations, signature stamps, text insertions, and page reordering/rotation/deletion.
  - **Null-Pointer Defense for Scanned PDFs**: Fortified against empty block arrays, completely preventing blank white screen crashes on scanned/image-only PDFs.
- 🖼️ **Image Pipeline Industrial Hardening & Lossless Quality Preservation**:
  - **HEIC Serial Transcoding & Anti-OOM Safeguard**: Reduced HEIC decoding concurrency to 1 with aggressive memory cleanup and thumbnail streaming, eliminating process freezes; full uppercase extension compatibility.
  - **Anti-Inflation Compression Protection**: Enforced strict output-to-input byte comparison, ensuring files never expand post-compression and preserving PNG transparency channels without black artifacts.
  - **Aspect-Ratio Preserved Batch Resizing**: Added Letterbox and Center-Crop padding modes to strictly prevent image stretching on mismatched aspect ratios.
  - **Adaptive Dynamic Watermarks**: Watermark font size and tiling density automatically scale according to image resolution, preventing miniature or exploded watermarks across mixed batches.
  - **ICO Rendering Fix & Alpha Protection**: Resolved blank placeholder issues on exported `.ico` icons while retaining lossless alpha transparency.
- 📊 **Spreadsheet Studio Evolution & Anti-OOM Guard**:
  - **Adaptive Header Row Detection (Rows 1~5)**: Automatically parses complex spreadsheets with multi-row merged banner headers to extract true column names.
  - **Multi-Sheet Intelligent Detection**: Detects multi-sheet workbooks and surfaces a fluid selector to choose specific target worksheets.
  - **High-Cardinality OOM Pre-Check**: Asynchronously inspects unique split-column values; displays a mandatory confirmation modal with group sample badges when group count > 100, preventing browser tab freezes.
  - **Strict Sheet Name Sanitization**: Strips illegal Excel characters `[ ] : * ? / \ '` and enforces the 31-character limit.
- 🧩 **Modular Architecture Refactoring**:
  - Refactored monolithic `ImageToolbox.tsx` and `AudioToolbox.tsx` into standalone sub-studio component directories for improved maintainability.

---

## 🌟 v1.5.1 Spreadsheet Studio, Smart File Organizer & Fast Duplicate Cleaner

- 📊 **New Spreadsheet Studio**:
  - **Sheet Merge**: Merges multiple Excel/CSV workbooks by header field matching, row-level deduplication, and optional source-file attribution columns.
  - **Sheet Split**: Splits large master sheets by any categorical column (Department, City, Status) into independent Excel files with one-click ZIP packaging.
- 🗂️ **Smart File Organizer**:
  - Intelligently organizes cluttered Desktop or Downloads folders by file category or modification timeline (`YYYY/MM/`), and safely isolates empty 0KB files.
  - **Dry-Run Preview**: Simulates all file move operations with collision prevention and safe fallback to ZIP download in web environments.
- ⚡ **Fast Duplicate Cleaner**:
  - Powered by a 3-tier short-circuit hash engine (Level 1: File size clustering $\to$ Level 2: 4KB header fingerprint $\to$ Level 3: Full hash verification), minimizing disk I/O.
  - Recommends originals and safely moves duplicate copies to the Windows Recycle Bin for easy undo.
- 🛠️ **Hardened Cross-Process IPC Pipeline**:
  - Standardized IPC contracts between Electron main process and renderer for robust background file system access.

---

## 🌟 v1.5.0 Enterprise UI/UX Overhaul

- 🎨 **Enterprise Visual Specification**:
  - Re-skinned all modules with duotone squircle icons, microchip parameter badges, radial ambient glow dropzones, and precision control sliders.
  - Visual and haptic refinement across Interactive PDF Editor, Image Studio, Audio Studio, and Daily Utilities.

---

## 🌟 v1.4.1 Document Studio Navigation Streamline

- 📑 **Document Studio Horizontal Scrollable Tab Bar**:
  - Added top horizontal sub-feature tab bar to Document & PDF workbench for 1-click navigation across all 10 document sub-tools.
  - Unified navigation experience with Image, Audio, Daily, and AI studios.

---

## 🌟 v1.4.0 Sub-Second Cold Boot & Keep-Alive Architecture

- ⚡ **Sub-Second Cold Boot (300ms UI Presentation)**:
  - Re-architected main process startup to launch the UI window in under 300 milliseconds.
  - Python hybrid runtime boots concurrently in the background with progressive soft retries.
- 🚀 **Keep-Alive Architecture with 0ms Tool Switching**:
  - Core studios run in persistent Keep-Alive containers, eliminating DOM re-renders and GC drops.
  - 120 FPS tool switching that preserves active files and configurations.

---

## 🌟 v1.3.2 Documentation & Protocol Refinement

- 📖 **Official User Manual Released**:
  - Comprehensive bilingual documentation [`USER_MANUAL.md`](USER_MANUAL.md) detailing quick start, core studio guides, shortcuts cheatsheet, and troubleshooting.
- 🌐 **System Browser Delegation**:
  - External links route directly to the user's default browser.
- 🔄 **Dynamic Version Sync**:
  - Settings modal dynamically synchronizes version information with Electron runtime.

---

## 🌟 v1.3.1 Module Streamlining & Focus

- 🧹 **Module Streamlining**:
  - Excised redundant miscellaneous utilities to focus Everyday Utilities on its flagship tools: ID Photo Studio, Artistic QR Code Generator & Scanner, and Article Diff Engine.

---

## 🌟 v1.3.0 Full-Stack 60~120 FPS Fluid Performance Engine

- 🏎️ **Chromium GPU Hardware Acceleration**:
  - Enabled `--enable-gpu-rasterization` and `--enable-zero-copy` flags.
- ⚡ **DOM Virtualization & Composited Layers**:
  - Integrated `content-visibility: auto` viewport clipping for batch queues with 50~200+ concurrent jobs.
- 🧊 **React 18 Non-Blocking Concurrent Transitions**:
  - Module navigation wrapped with `React.startTransition` for instant touch response.

---

## 🌟 v1.2.0 Global Shortcuts, Smart Clipboard & Zero-Copy Pipeline

- ⚡ **Global Productivity Shortcuts & Smart Clipboard**:
  - Shortcuts: `Ctrl + Enter` (Run), `Ctrl + S` (Quick save), `Ctrl + 1~5` (Switch tabs), `Ctrl + ,` (Preferences), `Ctrl + /` (Shortcuts cheat sheet).
  - Global Smart Clipboard (`Ctrl + V`): Paste copied images anywhere to route into appropriate studios.
- 🔗 **Zero-Copy Tool Chaining & Data Pipeline**:
  - In-memory `toolBus` enabling **"Send to..."** action menu across tools without intermediate disk saves.
- 🛡️ **Python Backend Self-Healing Supervisor**:
  - Native Electron process supervisor with automatic health probing and crash recovery.

---

## 🌟 v1.1.0 AI Creative Studio Expansion & Offline Security

- 🤖 **AI Magic Studio**:
  - **AI Inpaint Brush**: Dual-algorithm image restoration (Telea / Navier-Stokes).
  - **Dual-Layer Searchable PDF Maker**: High-fidelity OCR text layer embedding via Tesseract.
  - **Audio/Video Subtitle Studio**: Local Voice Activity Detection (VAD) generating SRT/VTT subtitles.
- 📝 **Article & Text Diff**:
  - Dual-column text comparison with inline diff and statistical changes.
- 🎨 **Theme System**:
  - Independent Pure White & Minimalist Dark theme customization.
- 📴 **100% Offline Privacy Guarantee**:
  - Fully functional without internet connection; zero API keys or external server uploads.
