# Active Architecture Context: Streamline & Release 1.3.1

## 1. Status: Cleaned Dev/RMB Module & Release 1.3.1
- Excised redundant "财务大写与日常实用" (RMB uppercase, stats, idcard, dev json/base64/hash/timestamp).
- Streamlined Everyday Utilities module to 3 core tools: `idphoto` (证件照), `qrcode` (二维码), `diff` (文章对比).
- Synchronized type definitions (`DailyTabType`, `ToolTab`), `TOOLS_REGISTRY`, and bilingual `i18n.tsx`.
- Bumped version to 1.3.1 across root, frontend, backend, electron, settings, and documentation.

## 2. Core Contracts & APIs
- `DailyToolbox.tsx`: 3-tab layout (`idphoto`, `qrcode`, `diff`), completely purged of dev states.
- `page.tsx`: Cleaned `TOOLS_REGISTRY` entry and updated category label to "日常与便民工坊".
- `i18n.tsx`: Updated English module translation to "Everyday Utilities".

## 3. Boundary & Error Isolation
- Preserved `SendToButton` and `toolBus` pipelines to `idphoto` and `diff` without breaking changes.
- Validated via `tsc --noEmit` and production Next.js export build.
