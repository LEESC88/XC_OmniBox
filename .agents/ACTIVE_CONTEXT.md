# Active Context: IDE Syntax Highlighting & English Sample (v1.6.8)

## 1. Current Step
- Step 1: Integrated `prismjs` syntax highlighting into `electron/services/markdownToDocxEngine.js` with VS Code Dark+ palette and seamless single-cell table container in Word (.docx).
- Step 2: Added English technical report sample and language-aware sample loader in `frontend/src/components/document/AiMarkdownToWordStudio.tsx`.
- Step 3: Streamlined and decluttered studio UI layout (segmented pill switcher, collapsible metadata drawer).
- Step 4: Verified Word COM generation and rendering (100% visual match, zero seams), passed `tsc --noEmit` and Next.js production build, bumped to `v1.6.8`.

## 2. Core Types & IPC Contract
- IPC `document:inspect-markdown`: returns `highlightedLines` token arrays with `{ text, color, bold }`.
- IPC `document:markdown-to-word`: renders single-cell container table with `#1E1E1E` background, `#569CD6` left accent bar, and colored `Consolas` runs.
- English sample: `SAMPLE_EN_MARKDOWN` loaded when `lang === "en"`.

## 3. Visual & Architecture Verification
- Word COM: 0 corruption warnings, paragraphs and tables verified.
- Visual rendering: `#1E1E1E` seamless background, zero hairline separators, keywords `#569CD6`, types `#4EC9B0`, strings `#CE9178`.
