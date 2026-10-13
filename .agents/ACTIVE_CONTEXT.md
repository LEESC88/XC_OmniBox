# Active Context (v1.6.2 Stirling-PDF Core Suite)
1. **Current Step**: v1.6.2 implementation & 45/45 E2E smoke tests completed; building & publishing GitHub Release v1.6.2.
2. **Core IPC & API Contracts**:
   - `document:sign-and-redact` -> `DocumentService.signAndRedactPdf({ fileBuffer, fileName, operations, dpi }, onProgress)`
   - `document:pdf-to-images` -> `DocumentService.pdfToImages({ fileBuffer, fileName, mode, format, dpi, quality, pageRanges }, onProgress)`
   - `document:nup-pdf` -> `DocumentService.nupPdf({ fileBuffer, fileName, pagesPerSheet, orientation, drawBorder, marginPt }, onProgress)`
3. **Edge Cases Verified**:
   - Redacted pages flattened at 200 DPI (0 extractable text tokens on redacted pages; non-redacted pages remain pure vector).
   - Long-image stitching caps each volume at `MAX_VOLUME_HEIGHT = 15500px` and auto-packages multi-volume outputs into ZIP.
   - N-Up vector imposition supports 2/4/6/9 pages per A4 sheet with custom margins and grid borders.
