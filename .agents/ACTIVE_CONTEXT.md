# Active Architecture Memory

## 1. 当前步骤
- 完成 Archify 架构图设计与高精度双主题矢量/PNG导出 (`docs/assets/architecture-*.png`, `docs/architecture.html`)。
- 解耦版本发布日志至 `CHANGELOG.md` 与 `CHANGELOG_ZH.md`，主 README 保持纯粹产品介绍。
- `README.md` 设为主英文，`README_ZH.md` 保持中文镜像。
- 更新 `scripts/publish-release.js` 支持直接读取 `CHANGELOG.md`。

## 2. 核心架构与资产
- 架构分层: Electron 桌面宿主 / Web Audio DSP 前端 / FastAPI 本地微服务 / 本地文件沙箱
- 资产输出: `.archify/architecture.json`, `docs/assets/architecture-{dark,light}.png`, `docs/architecture.html`
- 发布机制: `scripts/publish-release.js` 优先提取 `CHANGELOG.md` 对应版本块，回退至 `README.md`

## 3. 待处理边界情况
- 每次后续版本发布同步更新 `CHANGELOG.md` 及 `CHANGELOG_ZH.md`。
