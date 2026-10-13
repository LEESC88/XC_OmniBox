# Active Context (v1.5.5 方向三深化与边界加固)

## 1. 当前进度
- [x] 扫描与文字工坊：`ImageService.preprocessForOcr` (C++ Sharp 灰度归一化/限宽提速 5-8x)、`ImageService.enhanceImage` (Lanczos3 超分 + USM 锐化)、`DocumentService.generateSearchablePdf` (系统级中文字库缓存嵌入 + BoundingBox 动态字宽校准对齐)。
- [x] 大文件长任务进度条：打通 `preload.js` (`onTaskProgress`) 与 `ipcHandlers.js` (`task:progress`)，覆盖 PDF 合并/压缩/转图、图片批量打包、大表单遍解析合并/拆分、三级哈希查重。
- [x] 音频工坊：消除 `decodeAudioFile` 的 `.slice(0)` 双倍内存拷贝（省 500MB+ RAM），新增 `AudioService.extractPeaks` 跨步降采样（千万级采样点 < 2ms）。
- [x] 边界加固与全量回归测试：完成 40 项核心 + 边界回归用例验证。

## 2. 新增/更新 IPC 契约
- `image:ocr-preprocess` -> `{ buffer, width, height, originalWidth, originalHeight, scaleRatio }`
- `image:enhance` -> `{ buffer, originalWidth, originalHeight, newWidth, newHeight, scaleFactor }`
- `document:searchable-pdf` -> `{ buffer, filename, pageCount }`
- `audio:extract-peaks` -> `{ peaks: number[] }`
- Event `task:progress` -> `{ task: string, current: number, total: number, percent: number }`

## 3. 已闭环边界问题
- PDF 压缩防体积倒挂（小体积 PDF 压缩后若变大则回退原流）。
- Excel 按列拆分过滤 `[`、`]` 等非法 SheetName 字符及空分组名。
- 音频音量归一化过滤 `NaN`/`Infinity` 脏采样值与空通道防御。
