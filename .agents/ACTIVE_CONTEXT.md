# Active Architecture Context: Fluid Performance Engine & Release 1.3.0

## 1. Status: 60~120 FPS Fluid Optimization & Release 1.3.0 Complete
- GPU Acceleration: Chromium GPU rasterization, zero-copy, Canvas OOP rasterization, no background throttling.
- Virtual Rendering: `content-visibility: auto` on batch queue tasks; GPU composited layers on modals & views.
- Concurrent Navigation: `startTransition` on module switching for 0ms interaction response.
- RAF Event Loop: `requestAnimationFrame` on Squoosh quality slider & zoom/pan gestures.
- Release: Version bumped to 1.3.0 across frontend, backend, electron, and bilingual docs.

## 2. Core Contracts & APIs
- `electron/main.js`: `--enable-gpu-rasterization`, `--enable-zero-copy`, `--ignore-gpu-blocklist`.
- `globals.css`: `.gpu-layer`, `.virtual-scroll-item`, `.smooth-scroll`.
- `page.tsx`: `useTransition` wrapped `setActiveModule`.
- `ImageCompareModal.tsx`: RAF throttled `updateSplitFromPointer` & container pan.

## 3. Boundary & Error Isolation
- RAF handles cancel pending frames on unmount and before subsequent pointer movements.
- Spellcheck disabled in Electron webPreferences to prevent background worker stalls.
