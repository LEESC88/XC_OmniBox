# Active Architecture Context: AI Workshop Extensions

## 1. Status: All 3 Extensions Implemented & Verified
- Extension 1: AI Inpaint Brush (IOPaint C++ Telea/Navier-Stokes) + Interactive Canvas + Squoosh compare.
- Extension 2: Dual-Layer Searchable PDF Maker (Umi-OCR / Tesseract PDF renderer) + Invisible Text Layer.
- Extension 3: Audio/Video Subtitle Studio (Buzz Web Audio VAD) + Timestamp Alignment + SRT/VTT/TXT export.

## 2. Contracts & APIs
- `POST /api/v1/image/inpaint`: Multipart `file` + `mask` + `radius` + `method` -> Inpainted image.
- `generateSearchablePdf(file, lang, onProgress)`: Returns `{ blob, filename, text }`.
- `analyzeMediaSpeechSegments(file, onProgress)`: Returns `{ duration, items: SubtitleItem[] }`.
- `exportToSrt(items)` / `exportToVtt(items)`: Formatted subtitle files.

## 3. Verification & Compliance
- 100% offline local processing (zero cloud API keys, zero external data leakage).
- Strictly NO auto-download: Explicit user clicks on card download buttons.
- Next.js build: Static export compilation verified (0 errors).
- Pytest test suite: 23/23 tests passing.
