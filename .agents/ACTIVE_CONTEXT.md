# Active Architecture Memory: Spreadsheet Studio (Phase 1)

## 1. 当前进展
- Phase 1 MVP 落地完成：独立顶层模块 `spreadsheet`（表格工坊 / Sheets）。
- 已实现子工具: 
  1. `sheet-merge`: 多表智能纵向拼合（并集/交集对齐、来源文件名列、整行去重、表头探针）
  2. `sheet-split`: 单表按列极速拆分（指定列键分组、批量导出独立工作簿、ZIP 打包下载）
- 编译与验证: `next build` 100% 静态构建通过，跨工具总线 ToolBus 已接入。

## 2. 核心架构契约
- 引擎: `frontend/src/lib/spreadsheetProcessor.ts`
- 界面: `frontend/src/components/SpreadsheetToolbox.tsx`
- 顶层模块与主路由: `frontend/src/app/page.tsx`
- 国际化: `frontend/src/lib/i18n.tsx`
