# Active Architecture Context: UI & Settings Hardening

## 1. Status: Completed Settings & UI Simplification
- Settings Modal: Draft state with live preview; commits only on "保存设置"; prompt on uncommitted exit.
- Theme System: Strictly White & Dark; independent `saveWhiteTheme` / `saveDarkTheme` to avoid resets.
- Diff Tool: Renamed to "文章与文本对比"; English article diff presets (`ARTICLE_EN`) + Chinese article diff (`ARTICLE_ZH`).
- Typography: 5 English-first standard UI fonts (System, Inter, Roboto, Segoe UI, Mono); standard sample string.
- Slogan Cleanup: Removed all marketing/floral slogans across `layout.tsx`, `i18n.tsx`, `SettingsModal.tsx`.

## 2. Contracts & APIs
- `previewTheme(theme)` / `previewFont(fontId)`: In-memory live preview without writing to `localStorage`.
- `saveWhiteTheme(theme)` / `saveDarkTheme(theme)`: Separate custom palettes per mode.
- `getSavedWhiteTheme()` / `getSavedDarkTheme()`: Preserves custom styling on mode toggles.

## 3. Verification & Compliance
- `tsc --noEmit`: 0 errors.
- `next build`: 4/4 static pages generated successfully.
- `pytest backend/tests/`: 23/23 tests passed.
- 100% offline local processing, zero privacy leak.
