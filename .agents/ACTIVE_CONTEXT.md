# Active Architecture Context: User Manual & Release 1.3.2

## 1. Status: User Manual & Release 1.3.2 Complete
- Published bilingual official user manual (`USER_MANUAL.md` and `USER_MANUAL_EN.md`).
- Intercepted external URL opening: all links route directly to Windows default browser via `shell.openExternal`.
- Dynamically synchronized version display (`v{appVersion}`) in settings about panel; removed braggy slogan.
- Bumped version to 1.3.2 across root, frontend, backend, electron, settings, and documentation.

## 2. Core Contracts & APIs
- `electron/main.js`: `setWindowOpenHandler` and `will-navigate` forward HTTP(S) to `shell.openExternal`.
- `electron/preload.js`: `electronAPI.openExternal(url)`.
- `SettingsModal.tsx`: Dynamic version read via `api.getAppVersion()`, simplified about description.
- `USER_MANUAL.md` / `USER_MANUAL_EN.md`: Comprehensive 7-section user guide.

## 3. Boundary & Error Isolation
- Action `'deny'` on internal electron window creation prevents embedded browser popups.
- Verified via `tsc --noEmit` and production Next.js export build.
