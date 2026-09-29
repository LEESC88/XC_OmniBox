# Active Architecture Context: P0 Batch Pipeline Completed

## 1. Status: P0 Concurrency & Pipeline Completed
- Concurrency Engine: `frontend/src/lib/batchQueueManager.ts` (Worker Pool 1~6x, default 3x, ETA, error isolation).
- Progress UI: `frontend/src/components/BatchQueueProgress.tsx` (real-time progress, thread adjuster, retry, cancel).
- Integrated Tools: `ImageToolbox.tsx` (HEIC/Compress/Convert/Resize/Exif/Watermark) & `AudioToolbox.tsx` (Transcode & Parallel Track Decode).
- Export Pipeline: Electron `files:save-batch` native save with JSZip browser fallback.

## 2. Contracts & APIs
- `executeBatchQueue(items, processor, options)`: concurrency worker pool with AbortSignal.
- `exportBatchFiles(items, options)`: native folder export + JSZip bundle download.
- `BatchTaskItem<TInput, TOutput>`: granular status (`waiting`|`processing`|`completed`|`error`|`cancelled`).

## 3. Verification & Compliance
- `tsc --noEmit`: 0 errors.
- `npm run build`: Static export generated successfully (4/4 pages).
- `pytest backend/tests/`: 23/23 tests passed.
- 100% offline local processing with error isolation.
