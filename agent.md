# XC_OmniBox (XC 万象箱) - 项目总控与设计规范

> **本文档定位**：本项目（XC_OmniBox · XC 万象箱）的唯一权威规格书与架构档案。所有后续的功能规划、技术决策、架构调整与开发进度变动均统一记录在此文档中。

---

## 1. 项目定位与设计原则

打造一个现代、极简、高颜值、高保真且**完全免费（零成本运行）**的全能多功能在线工具箱。

### 核心设计原则
1. **浏览器优先计算 (Edge/WASM Compute)**：高频小文件处理（图片压缩、苹果 HEIC 转换、音频波形剪辑、视频提音频等）采用浏览器端 WebAssembly 在本地完成，**100% 保护用户隐私，且零服务器带宽与算力成本**。
2. **高保真后端计算 (High-Fidelity Server Engine)**：PDF 转 Word、Word 高清转 PDF、复杂文档重构、OCR 识别等重型任务交由 Python 后端引擎处理，确保 300+ DPI 打印级保真度与排版不崩。
3. **极简现代美学体验**：全站暗黑/浅色模式自适应、全拖拽文件上传、实时处理进度条、批量打包 ZIP 下载、最近常用记录与快速搜索。
4. **完全本地可跑 & 0 元云端上线**：支持在开发者本地电脑一键轻量启动运行，亦可免费托管至 Vercel (前端) + 免费容器服务 (后端)。
5. **代码自动同步与版本托管规范**：官方开源远程仓库已绑定至 `https://github.com/LEESC88/XC_OmniBox.git`。后续每次完成功能迭代、特性交付或 Bug 修复，均由 AI 自动记录变动日志、自动执行 commit 并自动 push 同步到 GitHub 远程仓库，确保版本始终与本地完全同步。

---

## 2. 编程语言与技术栈分布

| 模块 | 编程语言 | 核心技术 / 框架 / 库 | 用途与职责 |
| :--- | :--- | :--- | :--- |
| **前端应用 (Web Client)** | **TypeScript / JavaScript** | **Next.js 14+ (App Router)**<br>React 18/19<br>Tailwind CSS<br>Lucide React (图标)<br>Shadcn/Radix UI | 现代化响应式页面、卡片式工具大厅、全局搜索、暗黑模式切换、状态与文件拖拽管理 |
| **纯前端引擎 (WASM Client)** | **WebAssembly / JS** | `@ffmpeg/ffmpeg` (FFmpeg.wasm)<br>`pdf-lib` / `pdfjs-dist`<br>`browser-image-compression`<br>`heic2any`<br>`wavesurfer.js` | 浏览器端本地零服务器音视频转码剪切、图片极速无损压缩、苹果图片格式转换、PDF 轻量拼合与水印 |
| **后端服务 (Core Backend)** | **Python 3.10+** | **FastAPI**<br>Uvicorn (异步 ASGI)<br>Pydantic (数据验证)<br>PyMuPDF (`fitz`)<br>`pdfplumber`<br>`python-docx`<br>`Pillow` (PIL)<br>LibreOffice (Headless / unoserver) | 高保真文档解析转换、Word ↔ PDF 互转（锁定高清 300 DPI 原图）、PDF 逆向重构、OCR 识别等 |

---

## 3. 完整功能矩阵规划

### 模块一：文档工具箱 (Document Suite)
* **Word ↔ PDF 高保真互转**：
  * Word (.docx) 转 PDF：采用后端 LibreOffice 引擎，保留原始高分辨率图片（300+ DPI 打印级无损渲染），不失真、不掉格式、支持高阶字体排版。
  * PDF 转 Word (.docx)：智能分析文本块、表格与段落，实现可继续编辑的高保真 Word 文档。
* **PDF 在线编辑（双模式）**：
  * **模式 A（原位批注与修改）**：原版排版 100% 不动，支持涂抹覆盖、添加/替换文字、印章、批注、电子签名。
  * **模式 B（流式重构在线编辑）**：将 PDF 导入在线富文本编辑器，像 Word 一样任意敲回车、增删段落与图片，编辑完一键重新导出。
* **PDF 基础管理工具**：
  * PDF 合并（多文件顺序拖拽拼接）、PDF 拆分（按页提取/分割）。
  * PDF 页面旋转、删除指定页、PDF 极限无损压缩。
  * PDF 加密（权限密码保护）与解密去密。
  * PDF 自定义防盗/防伪水印（旋转倾斜、透明度、平铺）。
* **格式扩展**：
  * Markdown ↔ PDF / Word / HTML 转换。
  * 图片 / 扫描件 $\rightarrow$ 可选文本的高清 PDF。
  * *(进阶)* OCR 文本提取：从扫描件 PDF/截图一键抽取纯文本。

### 模块二：图片工具箱 (Image Suite)
* **万能格式转换**：支持 JPG, PNG, WebP, SVG, GIF, AVIF, ICO, BMP, TIFF 互转。
* **苹果生态神器**：苹果 HEIC / HEIF 原图格式一键转为 JPG/PNG（纯本地极速转换）。
* **智能无损/有损压缩**：类似 TinyPNG 级别的浏览器本地压缩，体积骤降 60%~80%，肉眼几乎无损。
* **图片编辑增强**：批量尺寸缩放、固定比例裁剪、圆角处理、批量添加文字/Logo水印。
* **隐私与安全**：EXIF 拍摄元数据（包含拍照 GPS 坐标、相机镜头参数、拍照时间）一键彻底清除。
* *(进阶)* **AI 纯前端一键抠图**：利用浏览器 WebGPU / ONNX 运行开源轻量抠图模型，零服务器费用抠出主体。

### 模块三：音频/音乐工具箱 (Audio Suite)
* **音频万能转码**：MP3, WAV, FLAC, AAC, OGG, M4A, Opus, WMA 等无损/有损格式自由互转（纯前端 FFmpeg.wasm 本地秒转）。
* **波形可视化剪辑**：交互式音频波形图（毫秒级拖拽、试听、裁剪、淡入淡出），制作手机铃声。
* **音频合并拼接**：多首音乐片段一键首尾无缝拼接。
* **视频提取音频**：上传 MP4/MOV/MKV 等视频，秒级无损提取为 MP3 或 AAC 音频。
* **音频音量增强**：自动音量标准化（解决录音声音太小的问题）。
* *(进阶)* **AI 人声与伴奏分离**：一键去除人声提取纯伴奏。

### 模块四：实用生活与效率工具 (Daily & Utilities)
* **局域网免装软件快传 (Local Share)**：基于 WebRTC 协议，同 WiFi 局域网下手机与电脑打开网页即可互相高速秒传文件，无须微信/QQ中转。
* **标准证件照换底色与排版**：红/蓝/白底一键抠图更换，生成 1寸 / 2寸 9宫格排版，方便直接打印。
* **个性化艺术二维码生成器**：支持自定义渐变色、中心嵌入 Logo、圆角与点阵样式，并支持二维码解码。
* **文本与代码差异对比器 (Diff Viewer)**：双栏高亮对比两个文本或代码段的不同之处。
* **常用开发小工具**：JSON 树状高亮格式化与校验、Base64 编解码、MD5/SHA256 哈希计算、时间戳互转。

---

## 4. 推荐系统目录架构设计

采用清晰的前后端分离结构（Monorepo 或 同仓两端），各司其职：

```text
OmniToolbox/
│
├── agent.md                        # [本项目核心规划与变动档案]
│
├── frontend/                       # [前端工程 - Next.js + Tailwind + WASM]
│   ├── public/                     # 静态资源、图标、WASM 核心文件
│   │   ├── ffmpeg/                 # ffmpeg wasm 核心与 worker
│   │   └── favicon.ico
│   ├── src/
│   │   ├── app/                    # Next.js App Router 路由体系
│   │   │   ├── layout.tsx          # 全局布局（顶栏、暗黑模式提供者、底栏）
│   │   │   ├── page.tsx            # 首页：工具大厅、搜索栏、分类卡片、最近使用
│   │   │   ├── pdf/                # PDF 相关工具独立页面
│   │   │   │   ├── word-to-pdf/
│   │   │   │   ├── pdf-to-word/
│   │   │   │   ├── edit/           # PDF 在线编辑工作台
│   │   │   │   ├── merge/
│   │   │   │   └── compress/
│   │   │   ├── image/              # 图片工具页面
│   │   │   │   ├── convert/
│   │   │   │   ├── compress/
│   │   │   │   └── heic/
│   │   │   ├── audio/              # 音频工具页面
│   │   │   │   ├── convert/
│   │   │   │   ├── trim/           # 波形剪辑
│   │   │   │   └── extract/
│   │   │   └── utils/              # 日常实用工具页面
│   │   │       ├── qr/
│   │   │       ├── diff/
│   │   │       └── id-photo/
│   │   ├── components/             # 公共 UI 组件
│   │   │   ├── ui/                 # 按钮、弹窗、下拉、卡片等基础原子组件
│   │   │   ├── Dropzone.tsx        # 通用拖拽上传带进度条组件
│   │   │   ├── Header.tsx          # 顶部导航与暗黑模式切换
│   │   │   ├── Footer.tsx
│   │   │   └── WaveformPlayer.tsx  # 音频波形可视化组件
│   │   ├── lib/                    # 浏览器端纯前端处理核心库 (WASM / 客户端辅助)
│   │   │   ├── ffmpeg.ts           # 本地音视频转码封装
│   │   │   ├── imageCompressor.ts  # 本地图片压缩与 HEIC 转换
│   │   │   ├── pdfClient.ts        # 本地 PDF 页面合并/提取/旋转
│   │   │   └── api.ts              # 与 Python 后端交互的统一 API 客户端
│   │   └── styles/                 # 全局 Tailwind 与主题样式
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
│
├── backend/                        # [后端服务 - Python 3.10+ FastAPI]
│   ├── app/
│   │   ├── main.py                 # FastAPI 入口主程序 (CORS、路由挂载、生命周期)
│   │   ├── config.py               # 环境配置与临时文件路径
│   │   ├── api/                    # 接口路由控制器
│   │   │   ├── v1/
│   │   │   │   ├── document.py     # Word/PDF 互转、PDF 解析、高清导出接口
│   │   │   │   ├── ocr.py          # 文字提取识别接口
│   │   │   │   └── health.py       # 探针检测
│   │   ├── services/               # 核心业务与底层引擎调用
│   │   │   ├── doc_converter.py    # 基于 LibreOffice 的高清 Word->PDF (300+ DPI 锁定)
│   │   │   ├── pdf_to_word.py      # PDF 逆向排版生成 Word
│   │   │   └── pdf_engine.py       # PyMuPDF / pdfplumber 底层处理逻辑
│   │   └── utils/                  # 临时文件清理、格式校验等工具函数
│   ├── requirements.txt            # Python 依赖清单
│   └── Dockerfile                  # 后端部署与容器化配置（可选）
│
└── README.md                       # 开源项目说明书
```

---

## 5. 本地开发与本地运行指南 (开发阶段)

未部署前，完全可以在 Windows 本地同时跑起前端与后端进行测试与联调：

### 1. 前置准备
* **Node.js**：v18.17+ 或 v20+（提供 npm/pnpm 运行环境）。
* **Python**：v3.10+ 或 v3.11+（支持异步 FastAPI）。
* *(可选高保真依赖)* **LibreOffice**：Windows 下下载官方安装包（免费开源），用于提供系统级高清无损文档转换支撑。

### 2. 启动 Python 后端服务
```powershell
# 1. 进入 backend 目录
cd backend

# 2. 创建并激活虚拟环境 (可选但推荐)
python -m venv venv
.\venv\Scripts\Activate.ps1

# 3. 安装依赖包
pip install -r requirements.txt

# 4. 启动本地开发服务 (支持热重载)
uvicorn app.main:app --reload --port 8000
```
* 后端启动后，浏览器访问 `http://127.0.0.1:8000/docs` 即可直接打开交互式 **Swagger API 文档** 测试所有接口。

### 3. 启动 Next.js 前端服务
```powershell
# 1. 打开新命令行终端，进入 frontend 目录
cd frontend

# 2. 安装 npm 依赖
npm install

# 3. 启动前端开发服务器
npm run dev
```
* 前端启动后，浏览器访问 `http://localhost:3000` 即可畅享完整多功能工具箱。

---

## 6. 变动日志与项目演进档案 (Changelog)

| 2026-09-14 | **v0.1.0 (规划定案)** | 初始化 | 1. 敲定架构技术栈：Next.js (TS) + Python FastAPI。<br>2. 确立“浏览器端 WASM 优先 + 后端高保真引擎支撑”架构，实现 100% 免费开发与 0 成本运行。<br>3. 详细规划四大工具矩阵：文档类（Word/PDF互转与在线编辑）、图片类（HEIC/压缩/转换）、音频类（FFmpeg.wasm转码剪辑）、日常实用类（快传/证件照/二维码/Diff）。<br>4. 制定标准项目目录规范与本地调试运行全套指南。 |
| 2026-09-14 | **v0.2.0 (策略调整)** | 策略与架构升级 | 1. **深度借鉴 GitHub 开源顶级项目**：吸收 Stirling-PDF（无状态 REST 管道架构）、pdf2docx（基于 PyMuPDF + python-docx 的逆向排版与表格还原算法）、Gotenberg/LibreOffice（300+ DPI 无损高清 PDF 导出参数）、IT-Tools（极简工具箱分类与纯前端小工具集合）。<br>2. **开发流程确立**：**后端优先**。先完成 Python FastAPI 后端全部转换接口与测试，通过 FastAPI 自动生成的交互式 Swagger 文档进行上传与效果验收，确认功能稳定后再搭建 Next.js 前端进行联调，最后再进行 UI 美化。 |
| 2026-09-14 | **v0.3.0 (后端落地)** | 核心后端实施完成 | 1. **免权限轻量部署 Python 3.11**：通过官方 uv 工具在本地快速配置 CPython 3.11.16 与独立虚拟环境 `backend/venv`。<br>2. **落地核心转换引擎**：<br> - `PdfToWordService` (基于 pdf2docx，逆向还原段落、表格与内嵌高清图片)<br> - `WordToPdfService` (自适应检测 MS Word COM / LibreOffice 300+ DPI 打印级无损导出)<br> - `PdfService` (PDF 合并、拆分/提取、矢量任意角度倾斜水印、密码权限加密与解密)<br>3. **落地 RESTful API 与自动化生命周期**：封装 `/api/v1/document/*` 与 `/api/v1/pdf/*` 接口，结合 BackgroundTasks 实现临时文件无痕清理保护隐私。<br>4. **验证通过与服务启动**：全套单元测试与端到端 API 测试 100% 通过（耗时仅 0.03s~0.33s）；后端服务已在 `http://127.0.0.1:8000` 启动，Swagger UI 可直接在 `http://127.0.0.1:8000/docs` 体验测试。 |
| 2026-09-14 | **v0.4.0 (前端落地)** | 极简可视化操作界面 | 1. 采用 Next.js 14 (App Router) + Tailwind CSS + Lucide 图标搭建极简操作台。<br>2. 顶栏实时健康探针监控（直观显示 Python 后端与 Word 引擎在线状态）。<br>3. 实现分类 Tab（PDF转Word、Word转高清PDF、PDF合并拆分、文字水印与加密保护）。<br>4. 通用拖拽上传（Dropzone）与一键直观下载，免去手动调用 API 文档的繁琐。 |
| 2026-09-15 | **v0.5.0 (PDF Edit)** | PDF 在线直接编辑 (Word级) | 1. **全链路研发**：用户上传 PDF $\rightarrow$ 后端 `pdf2docx` + `mammoth` 逆向解析为精美结构化 HTML5 富文本。<br>2. **Office 仿真实时工作台**：前端打造 A4 纸张拟真视图，配备加粗/倾斜/颜色/标题/对齐/列表等全套 Word 级工具栏，可直接在网页里随意打字修改。<br>3. **双向一键无损导出**：修改后支持一键导出 300+ DPI 打印级超清 PDF（依托 Windows Word COM 原装打印引擎），并支持一键导出标准可编辑 Word (.docx)。 |
| 2026-09-15 | **v0.6.0 (原位编辑重大重构)** | 1:1 原版 PDF 视觉就地编辑 | 1. **痛点攻关**：彻底淘汰 HTML 重排方案（解决字体大小、字间距、段落跑偏问题）。<br>2. **真 PDF 画布渲染**：基于 PyMuPDF 1:1 提取原版高清晰度页面背景与精确物理文字坐标块。<br>3. **就地改字与修正带涂抹**：用户直接在原版真实 PDF 上点击文字原地替换、随意涂抹遮盖、任意位置新增文字。<br>4. **原子级原版另存**：后端直接在原始 PDF 二进制流上做局部修改，确保原文档格式、间距、背景表格 100% 绝对不跑位！ |
| 2026-09-15 | **v0.7.0 (图片工具箱全面落地)** | 模块二：图片工具箱全套交付 | 1. **顶级分类导航**：前端首页新增「📄 文档工具箱」与「🖼️ 图片工具箱」大模块平滑切换。<br>2. **苹果 HEIC/HEIF 秒转**：纯本地解码 iPhone/iPad 实拍照片，极速导出无损 JPG/PNG。<br>3. **TinyPNG 级智能压缩**：客户端双三次重采样与体积约束，体积直降 60%~80%，支持滑块微调与效果对比。<br>4. **万能格式互转**：支持 JPG, PNG, WebP, AVIF, ICO, BMP 自由转换，自动生成多尺寸 ICO 图标。<br>5. **尺寸缩放与常用预设**：百分比缩放、自定义像素、证件照（1寸/2寸）与社交配图（小红书/微信头像/壁纸）规格一键套用。<br>6. **EXIF 隐私抹除**：彻底清除拍照 GPS 地理坐标、相机序列号与时间戳，社交分享零泄漏。<br>7. **批量水印与 ZIP 打包**：支持平铺/方位文字水印与透明 PNG Logo 水印；支持一键打包下载全部处理结果为 ZIP 压缩包。 |
| 2026-09-15 | **v0.8.0 (音频工具箱全面落地)** | 模块三：音频/音乐工具箱交付 | 1. **免装 FFmpeg 架构突破**：完全基于原生 Web Audio API 与分块 LAME MP3 纯前端编码引擎，无需用户在本地系统配置庞大 FFmpeg，即开即用、零服务器流量。<br>2. **交互式波形剪辑与铃声**：真实振幅波形渲染、双游标毫秒级拖拽、动态播放线跟随、试听循环与开头/结尾 0~5s 平滑淡入淡出。<br>3. **音频万能转码**：支持 MP3, WAV, AAC, M4A, OGG, FLAC 互转，支持 128k~320k 自由比特率与 CD 级 16-bit PCM 无损 WAV，支持批量转码与 ZIP 打包。<br>4. **多音频无缝拼接**：多音轨队列管理、上下顺序调整、智能对齐重采样合成单曲。<br>5. **视频秒提音频**：拖入 MP4/MOV/WebM 视频直接在本地剥离纯净 MP3/WAV，无需上传百兆大视频。<br>6. **音量放大与防破音**：自动峰值标准化 (Peak Normalization 至 -0.1dB) 与 150%~300% 增益调节。 |
| 2026-09-15 | **v0.9.0 (实用生活与效率工具落地)** | 模块四：实用生活与效率工具箱交付 | 1. **顶级四合一大模块矩阵**：全站贯通「📄 文档」、「🖼️ 图片」、「🎵 音频」、「🛠️ 实用工具」四大独立产品矩阵。<br>2. **证件照换底与 6 寸排版**：红/蓝/白/灰底一键平滑换底；自动生成标准 6 寸 300 DPI 相纸 1寸 (9张) / 2寸 (4张) 打印大图（附带浅灰色裁切虚线与十字标记），可直接送冲印店低成本打印。<br>3. **个性化艺术二维码**：网址/文本生成二维码，支持渐变配色、中心嵌入品牌 Logo、High 级纠错与 PNG 导出；支持截图解码。<br>4. **文本与代码双栏 Diff**：双栏并排对比、行级/词级细粒度高亮差异、增删行统计与一键交换。<br>5. **开发效率神器集**：JSON 树状高亮格式化与语法纠错、Base64 UTF-8 安全编解码、Web Crypto 原生秒算 SHA-256/SHA-512/MD5、Unix 秒/毫秒时间戳与北京时间实时互转。 |
| 2026-09-21 | **v1.0.0 (桌面客户端与自动更新体系)** | 桌面应用独立化 (Electron + PyInstaller + NSIS + Auto-Update) | 1. **独立免装运行架构 (Sidecar 伴侣进程)**：通过 PyInstaller 将 FastAPI 后端与全部核心底层引擎（PyMuPDF、Word COM、pdf2docx 等）固化打包为独立二进制 `omni-backend.exe`，免除终端用户配置 Python/pip 环境；Electron 桌面主进程负责开机自启并监听于专用端口 18520，并在应用退出时依托 `tree-kill` 彻底回收进程树。<br>2. **Next.js 纯静态导出适配**：启用 `output: 'export'`，前端全面静态化渲染并入桌面包，动态适配本地桌面 API 端口。<br>3. **工业级 Windows 一键安装包**：依托 `electron-builder` + NSIS，一键生成 `XC_OmniBox-Setup-1.0.0.exe`，自带高清 256x256 Logo、桌面与开始菜单快捷方式。<br>4. **无缝自动更新中心 (Auto-Update)**：接入 `electron-updater` 绑定 GitHub Releases (`LEESC88/XC_OmniBox`)，侧边栏底部提供「软件更新中心」；支持静默检测、下载进度条跟踪、一键退出覆盖安装并自动重启。<br>5. **开发与构建脚本体系**：新增 `run_desktop_dev.bat`（毫秒级热重载调试）与 `build_installer.bat`（一键打包分发）。 |

*(后续任何技术修改、功能增减、需求调整均在此表格及对应章节做追踪记录)*





