# Active Context (v1.6.3 PDF 局部文字原地修正与排版还原修复)

## 1. 当前进度
- [x] 消除预览画面拉伸：画板容器添加 `flex-shrink-0`，锁定原始宽高比 `aspectRatio: width / height`，杜绝一切弹性盒挤压变形。
- [x] 原版字形字重自动继承：`inspectPdfText` 解析 PDF 字体元数据（Times/Helvetica/Courier/宋体等、Bold、Italic），点击文字自动 1:1 继承。
- [x] 原生西文矢量字体与中文隔离：西文字符严格采用 PDF 原生标准 14 矢量字体（如 `TimesRomanBold`），彻底杜绝黑体全角字符与宽空格。
- [x] 分词与连字符保护：基于物理字符间距精确补空格，严禁粗暴盲目加空格破坏连字符（如 `Full-Stack`）。
- [x] 闭环验收：TypeScript 零报错，46 项全量测试 100% 通过。
- [x] 发布包构建：全自动化重新打包并覆盖发布至 GitHub Release。

## 2. 核心契约与变更
- `PdfInspectItem` & `PdfTextPatch` 增加 `isBold`, `isItalic`, `detectedFont`。
- `applyPdfTextPatches` 升级 `loadFont(family, isBold, isItalic, sampleText)`，自动区分 CJK 与 Latin。

## 3. 已闭环边界防御
- 消除任何视口比例失真，锁定绝对比例。
- `autoFit` 阈值放宽至 `1.03`，微调词语不触发字号骤缩。
