# Active Context: IDE Code Blocks & Spacious UI (v1.6.8)

## 1. Current Step
- Step 1: Integrated Prism.js tokenizer into `electron/services/markdownToDocxEngine.js` with VS Code Dark+ color map.
- Step 2: Rendered code blocks via seamless 1-cell Table container with `#1E1E1E` background & `#007ACC` accent line.
- Step 3: Added dedicated English architecture report sample synced with `lang === "en"`.
- Step 4: Redesigned `AiMarkdownToWordStudio.tsx` to unclutter and open up visual spacing.
- Step 5: Verified with Word COM PDF/PNG render + Next.js build + ready for GitHub release `v1.6.8`.

## 2. Core Types & IPC Contract
- `tokenizedLines`: `Array<Array<{ text: string; type: string; color: string; italic?: boolean }>>`
- Theme colors: `#569CD6` (keywords), `#DCDCAA` (functions), `#4EC9B0` (types), `#B5CEA8` (numbers), `#6A9955` (comments).

## 3. Edge Cases Handled
- Line-by-line token segmentation avoids multi-line run collapse.
- 1-cell Table avoids Word paragraph dividing border gaps.
- Empty code lines preserve single space to retain line height.
