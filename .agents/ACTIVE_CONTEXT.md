# Active Context (v1.6.3 PDF 局部文字原地修正)

## 1. 当前进度
- [x] 后端服务：`documentService.js` 实现 `inspectPdfText` 与 `applyPdfTextPatches`。
- [x] IPC 通道：注册 `document:inspect-pdf-for-edit` 与 `document:apply-text-patches`。
- [x] 前端模块：新建 `PdfInplaceTextStudio.tsx`，支持双模修正（搜索替换 + 可视点击框选）。
- [x] 工坊集成：接入 `DocumentToolbox.tsx` 与首页路由导航（共 13 项工具）。
- [x] 冒烟测试：46 项全量测试与极端边界用例 100% 通过。

## 2. 核心契约与变更
- `document:inspect-pdf-for-edit` -> `{ success, fileName, numPages, pages: [{ pageIndex, image, items }] }`
- `document:apply-text-patches` -> `{ success, buffer, filename, patchCount }`
- 智能排版自适应：检测字符宽度并动态缩小字号防超界；涂白遮罩消除原印迹。

## 3. 已闭环边界防御
- TTC 与 TTF 字体子集化兼容：针对 `simhei.ttf`/`simkai.ttf` 启用 `subset:true` 压榨体积，`.ttc` 集合启用 `subset:false` 防崩溃。
- 无文字项防御与空 Patch 优雅拦截。
