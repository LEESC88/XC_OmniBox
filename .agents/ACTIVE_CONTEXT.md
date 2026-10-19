# Active Context: AI / Markdown to Standard Styled Word (v1.6.7)

## 1. Current Step
- Step 1: Implement `DocumentService.inspectMarkdown` & `DocumentService.markdownToWord` in `electron/services/documentService.js`.
- Step 2: Register IPC handlers in `electron/ipcHandlers.js` and frontend bindings in `frontend/src/lib/api.ts`.
- Step 3: Build `frontend/src/components/document/AiMarkdownToWordStudio.tsx` and wire into `DocumentToolbox.tsx` & `page.tsx`.
- Step 4: Verify via automated script + real Word COM opening test, `tsc --noEmit`, build, and publish `v1.6.7`.

## 2. Core Types & IPC Contract
- IPC `document:inspect-markdown`: `({ content, fileBuffer, fileName, cleanAiArtifacts }) => MarkdownInspectResult`
- IPC `document:markdown-to-word`: `(MarkdownToWordOptions) => { success, buffer, filename, mime, stats }`
- Templates: `'gov-redhead' | 'business-report' | 'academic-paper'`
- SubTab ID: `'ai-md-to-word'` in `DocTabType`.

## 3. Edge Cases Handled
- Dual-script fonts (`ascii`/`hAnsi` vs `eastAsia`) & `w:lang` (`en-US` + `zh-CN`).
- Dynamic column-width floor rebalancing (`TEXT_COL_FLOOR_DXA`) to prevent 1-char vertical stacking in Word tables.
- Distinct `numbering` instances per ordered list so lists restart at `1.`.
- HTML `<table>` / `<br>` / clipboard rich-text fallback & GFM pipe tables, task checkboxes (`CheckBox`), code blocks, blockquotes, links.
