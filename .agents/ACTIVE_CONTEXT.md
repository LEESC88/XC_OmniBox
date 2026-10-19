# Active Context: IDE Code Blocks & Spacious UI (v1.6.8)

## 1. Current Step
- Step 1: Registered `ai-md-to-word` in `TOOL_TRANSLATIONS` (`i18n.tsx`) for bilingual tool card/search/header support.
- Step 2: Localized all input placeholders (`headerText`, `redHeaderOrg`, `docNumber`), checkboxes, and template badges in studio.
- Step 3: Word OpenXML engine footer dynamically formats as `— Page X of Y —` (EN) and `— 第 X 页 / 共 Y 页 —` (ZH).
- Step 4: COM test verified via `verify_en_footer.png` & `verify_zh_footer.png`.
- Step 5: Published overwrite release `v1.6.8` to GitHub Releases.

## 2. Core Types & IPC Contract
- `MarkdownToWordOptions`: added `lang?: string`
- `convertMarkdownToWord`: forwards `lang` to backend engine

## 3. Edge Cases Handled
- `isEn` detection checks explicit `lang === 'en'` or absence of CJK chars.
- Preview paper footer and Word footer strictly aligned to current language.
