# Active Context (v1.6.3 PDF 局部文字原地修正)

## 1. 当前进度
- [x] 后端契约：`inspectPdfText` 输出精确百分比坐标与 `lines` 整行语义聚合；`applyPdfTextPatches` 兼容百分比与点阵坐标。
- [x] 原地所见即所得：前端升级为页面内直接原位输入框（覆盖原字打字）+ 悬浮迷你排版工具条（字体、字号、色块）。
- [x] 多模粒度：支持整行编辑（Line Mode，Word体验）、单词精修（Word Mode）、自由画框模式（Draw Box Mode）。
- [x] 闭环验收：TypeScript 零报错，46 项全量端到端冒烟测试 100% 通过。
- [x] 发布包构建：全自动化重新打包与 GitHub Release 覆盖发布。

## 2. 核心契约与变更
- 坐标矩阵：`[1, 0, 0, -1, -pageX, pageY + pageHeight]` 变换计算 `leftPercent`, `topPercent`, `widthPercent`, `heightPercent`。
- 整行聚合：`|Δy| <= 4pt` 聚合同一行文字词元，彻底消除碎片化。

## 3. 已闭环边界防御
- 消除百分比/DPI浮点偏移，彻底解决选框垂直漂移错位。
- 文本自适应缩放防重叠，空补丁数组与空数据流 100% 优雅拦截。
