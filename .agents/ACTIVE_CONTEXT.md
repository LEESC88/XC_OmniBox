# Active Context (v1.6.2 Office 媒体资产提取)

## 1. 当前进度
- [x] 后端服务：新增 `DocumentService.extractOfficeMedia`，纯本地无损解构 OpenXML 容器内的原图与媒体文件。
- [x] 模块化演进：新建 `frontend/src/components/document/OfficeMediaExtractStudio.tsx`，保持功能独立解耦。
- [x] 前后端契约：打通 `document:extract-media` IPC 通道与实时进度流 `onTaskProgress`。
- [x] 工坊扩展：【文档与文字工坊】扩充至 12 项高密度工具；完成全量冒烟测试与类型检查。

## 2. 核心契约与变更
- `document:extract-media` -> `{ success, count, totalSize, items, zipBuffer, zipFilename, message }`
- 前端 `extractOfficeMedia(file)` -> 转换 `zipBuffer` 为标准下载 Blob 并支持缩略图卡片展示。

## 3. 已闭环边界问题
- 空媒体文档友好拦截（`count: 0` 且友好提示，杜绝抛出空指针）。
- 损坏或非 Office 文档格式前置校验防御。
- 自动化序列命名（`01_image1.png`），避免解压后重名文件互相覆盖。
