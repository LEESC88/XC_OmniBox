# Active Architecture Memory: Releases & Pipelines

## 1. 状态与交付
- 当前发布版本: `v1.5.1` (Git Tag + GitHub Release 均已同步完成)
- 产物发布状态: `XC_OmniBox-Setup-1.5.1.exe` (~186MB)、`.blockmap` 与 `latest.yml` 均已全量上传至 GitHub Releases。
- 一键 Release 管道: 集成 `npm run release:publish` (`scripts/publish-release.js`)，后续任何更新只需一键调用即可自动完成「前端构建 -> 签名打包 exe -> 提取更新日志 -> 上传 GitHub Release」。
