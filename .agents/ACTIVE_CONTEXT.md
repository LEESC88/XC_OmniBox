# Active Architecture Context: Document Horizontal Tabs & Release v1.4.1

## 1. Status: Release v1.4.1 Complete
- **Document Tab Bar**: Added `ScrollableTabNav` to Document workbench with 10 sub-tools, matching Image, Audio, Daily, and AI studios.
- **Full Release Automation**: Built Windows installer `XC_OmniBox-Setup-1.4.1.exe` + published GitHub Release with all binary assets.
- **Version Bump**: Synced v1.4.1 across package.json, frontend, backend, settings, and READMEs.

## 2. Core Contracts & APIs
- `frontend/src/app/page.tsx`: `ScrollableTabNav` hooked to `docTabs` memo and `handleDocTabChange`.
- `electron/main.js`: 300ms parallel cold launch + async backend health monitoring.
- `frontend/src/lib/api.ts`: Microsecond soft retry in `apiFetch`.

## 3. Verification & Quality Gates
- TypeScript check (`tsc --project frontend/tsconfig.json --noEmit`) 100% passed.
- Production build & electron-builder packaging verified.
