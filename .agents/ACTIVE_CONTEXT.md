# Active Architecture Context: Cold Boot & Keep-Alive v1.4.0

## 1. Status: Release v1.4.0
- **Cold Boot Speedup**: `electron/main.js` now parallelizes window creation (`createWindow()` in <300ms) with background Python startup.
- **Resilient API Bridge**: `frontend/src/lib/api.ts` implements warm-up retry loop before supervisor self-healing.
- **0ms Keep-Alive Switching**: `frontend/src/app/page.tsx` utilizes `visitedModules` + CSS `hidden`/`block` + `animate-fade-in` to retain DOM & state.
- **Version Bump**: Synced v1.4.0 across root, frontend, backend, settings, and READMEs.

## 2. Core Contracts & APIs
- `electron/main.js`: Non-blocking window presentation + async `waitForBackend` status IPC.
- `frontend/src/lib/api.ts`: Progressive retry loop in `apiFetch` for seamless warm-up handoff.
- `frontend/src/app/page.tsx`: Keep-Alive module containers for document, image, audio, utilities, and AI.

## 3. Verification & Quality Gates
- TypeScript check (`tsc --project frontend/tsconfig.json --noEmit`) 100% passed.
- Production static export (`npm run build:frontend`) verified.
