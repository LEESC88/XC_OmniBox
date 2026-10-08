# XC_OmniBox (XC 万象箱)

<p align="center">
  <strong>极速本地离线多功能工具箱 / Fast Local Offline Multimedia & Dev Toolbox</strong>
</p>

<p align="center">
  <a href="README_EN.md">English</a> | <strong>简体中文</strong> | <a href="USER_MANUAL.md"><strong>📖 用户使用手册</strong></a>
</p>

<p align="center">
  <a href="https://github.com/LEESC88/XC_OmniBox/releases/latest">
    <img src="https://img.shields.io/github/v/release/LEESC88/XC_OmniBox?style=flat-square&color=2563EB" alt="Release" />
  </a>
  <a href="https://github.com/LEESC88/XC_OmniBox/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="License" />
  </a>
  <img src="https://img.shields.io/badge/platform-Windows%20x64-lightgrey?style=flat-square" alt="Platform" />
  <img src="https://img.shields.io/badge/privacy-100%25%20Offline-success?style=flat-square" alt="100% Offline" />
</p>

---

## 📖 简介 / Introduction

**XC_OmniBox (XC 万象箱)** 是一款基于 Electron + Next.js (React) + FastAPI (Python 混合引擎) 构建的现代化本地多功能工具箱。致力于为创作者、工程师、办公人士提供**100% 纯本地离线运算、零隐私泄漏、零云端限制、秒级响应**的一站式多媒体与日常效率工具。

## 🌟 v1.5.3 日常工坊深度优化与更新版本动态对齐 / What's New in v1.5.3

- 🗂️ **日常工具工坊深度优化与可靠性增强**：
  - **文章对比 (Text Diff) 排版修复**：修复按词精细 diff 文本在界面中的换行崩塌，全面重构为内联流式自然排版并完美兼容深浅色主题。
  - **证件照智能排版与漫水换底**：自适应非标相纸（如小2寸等）行列排版与正向保底间距（保底间距 $\ge$ 10px），消除重叠与画布溢出；升级 4-邻域 BFS 边缘漫水算法，保护人像主体浅色服装及细节不被误抠；羽化滑块调整至 1~30px 并增加除零防御。
  - **二维码工坊寻象定位角保护**：强制保护三大 7×7 寻象定位角（Finder Patterns），在圆点与圆角模式下定位角始终保持实心规整几何，恢复 100% 镜头扫码识别率；新增支持直接按 `Ctrl+V` 从剪贴板粘贴屏幕截图进行极速离线解码。
  - **目录智能归类防碰撞与安全模式**：新增源与目标路径一致性检测，杜绝已归类文件的自我循环重命名追加 `(1)`；新增“仅整理根目录顶层文件”防破坏安全模式；自动过滤 `desktop.ini`、`Thumbs.db`、`~$*` 及快捷方式等系统隐蔽文件。
  - **重复文件极速排重自定义原件**：支持组内任意副本一键「设为原件」自由指定保留项，并自动调配待清选集；增加直接在资源管理器中定位与打开文件的快捷入口。
- 🔄 **全局版本号对齐与动态更新感知**：
  - 修复侧边栏底部「软件更新中心」卡片版本号静态硬编码滞后的问题，支持从原生主进程动态获取当前版本号，全局各模块版本号（Root package, Frontend package, Backend FastAPI, Settings, Updater）严格同步对齐至 `v1.5.3`。

---

## 🌟 v1.5.2 体验与可靠性全面跃升 / What's New in v1.5.2

- 📑 **文档工坊核心恢复与安全防御**：
  - **恢复 PDF 原位可视化高精度编辑器**：修复顶层全屏视口挂载问题，完美恢复文本搜索与涂白、矩形与高亮标注、签名、文字插入及页码旋转/删除/重排等全套操作。
  - **纯图/扫描版 PDF 崩溃防御**：深度修复空文本块导致的运行时空指针，避免极端扫描版 PDF 白屏。
- 🖼️ **图片管线工业级加固与无损画质保护**：
  - **HEIC 串行转码与内存风暴防护**：将解码并发降为 1 串行执行并及时回收内存，补充即时缩略图渲染，彻底消除卡死与黑盒空白感；大写扩展名全面兼容。
  - **图片压缩防反向增肥**：建立体积比对兜底机制，杜绝“越压越大”，保护 PNG 透明通道不出现纯黑底底色。
  - **批量缩放等比安全模式**：新增等比留白与等比裁切模式，严禁非同比例图片强行拉伸变形。
  - **自适应动态水印**：字号与平铺密度自动随底图分辨率缩放，杜绝高低分辨率混批下的微型化或爆屏。
  - **ICO 破图修复与透明通道保护**：修复 ICO 导出结果占位裂图问题，保持 WebP/AVIF 等格式透明通道完整。
- 📊 **表格工坊智能进化与防 OOM 崩溃**：
  - **表头所在行自适应 (1~5行)**：自适应带跨列大标题横幅的复杂中国式报表，精准提取真实字段名。
  - **多工作表 (Multi-Sheet) 智能检测**：自动探测工作簿多 Sheet 结构并提供切换选择器。
  - **高基数列防 OOM 预警与确认拦截**：异步探测拆分列唯一键值；当分组数 > 100 时强制醒目警告并要求二次确认，展示代表性分组采样徽章，防止生成数千个文件导致浏览器内存耗尽假死。
  - **工作表名合规清洗**：严格剥离微软 Excel 非法字符 `[ ] : * ? / \ '` 并限制 31 字符以内，杜绝打开报错。
- 🧩 **架构模块化重构**：
  - 将 `ImageToolbox.tsx` 和 `AudioToolbox.tsx` 重构拆分为独立的子 Tab 组件目录，大幅提升前端维护性与性能。

---

## 🌟 v1.5.1 表格工坊、目录智能归类大师与极速排重 / What's New in v1.5.1

- 📊 **全新「表格工坊 (Spreadsheet Studio)」**：
  - **多表智能拼接 (Sheet Merge)**：支持拖拽或选择多个 Excel / CSV 工作簿，自动识别表头字段并对齐合并，支持行级去重与数据来源列追加，秒级导出合并表格。
  - **单表按列拆分 (Sheet Split)**：上传大型汇总表格，支持按任意分类列（如部门、城市、类型）自动拆分为独立的 Excel 文件并一键打包 ZIP 导出。
- 🗂️ **目录智能归类大师 (Smart File Organizer)**：
  - 专为杂乱的桌面、下载文件夹或工程资料库打造，支持按**文件格式类型**（文档/图片/视频/音频/压缩包/安装包/代码）、**修改年月时间轴**（`YYYY年/MM月/`）自动归档，以及精准隔离 **0KB 无效空文件**。
  - **可视化变更试运行预演清单 (Dry-Run Preview)**：执行真实移动前清晰预演拟变更路径与统计，重名冲突自动追加序号防覆盖，纯网页环境自动降级打包 ZIP 下载。
- ⚡ **重复文件极速排重清理 (Fast Duplicate Cleaner)**：
  - 对标开源标杆 `czkawka` 架构，搭载 **三级阶梯短路哈希引擎**（Level 1: 文件大小字典聚类 $\to$ Level 2: 头部 4KB 局部指纹短路检验 $\to$ Level 3: 终审全量哈希比对），极致节约磁盘 I/O。
  - 智能推荐保留原件并标记冗余副本，支持一键安全移入 **Windows 系统回收站**，避免硬删除导致误删，支持随时原路撤回还原。
- 🛠️ **跨端 IPC 管道加固与双模自适应**：
  - 规范并强化 Electron 主进程与渲染层在扫描、整理与回收站清理等文件操作的 IPC 契约通信，确保 100% 健壮运行。

---

## 🌟 v1.5.0 全工坊企业级 UI/UX 全面重塑 / What's New in v1.5.0

- 🎨 **企业级高阶设计语言与视觉规范 (Enterprise UI Overhaul)**：
  - 全模块升级为 Squircle 微曲双色调渐变图标组、参数微芯片徽章、环境径向柔光 Dropzone 与精密控制滑轨。
  - PDF 交互式可视化编辑器、图片工坊、音频工坊与日常便民工坊全链路触感与视觉质感升级。

---

## 🌟 v1.4.1 文档子功能横向导航与交互统一 / What's New in v1.4.1

- 📑 **文档工作台横向滚动导航条 (Document Scrollable Tab Bar)**：
  - 为「文档处理与 PDF」工作台补齐了顶部横向子功能 Tab 切换栏（支持 10 大子工具一键直达），与图片、音频、日常实用和 AI 创意工坊达成 100% 交互与视觉体验统一。
  - 支持滚轮横向平滑滚动、鼠标拖拽手势、微型滑动条指示器与左右快速翻页箭头。

---

## 🌟 v1.4.0 极速启动与瞬切架构 / What's New in v1.4.0

- ⚡ **300ms 极速冷启动呈现 (Sub-Second Cold Boot)**：
  - 重构主进程启动流程，窗口渲染由同步阻塞改为并行异步拉起，UI 界面在 300 毫秒内瞬间呈现，彻底告别双击后的假死与长时间等待感。
  - Python 混合后端在后台并发热身，配合前端柔性渐进重试机制，用户感知启动速度提升 10 倍以上。
- 🚀 **模块 Keep-Alive 0ms 瞬切与工作区驻留 (Keep-Alive Architecture)**：
  - 核心工坊（文档、图像、音频、实用工具、AI工坊）全面升级为 Keep-Alive 存活驻留架构，杜绝频繁切换时的组件反复销毁与 GC 掉帧。
  - 切换工具 120 FPS 满帧秒切，且跨工具切换时完整保留用户已上传的文件、参数调节与比对现场，工作流丝滑无中断。

---

## 🌟 v1.3.2 细节优化与用户手册 / What's New in v1.3.2

- 📖 **官方用户手册发布 (User Manual)**：
  - 编写了详尽的中英文官方用户操作手册 [`USER_MANUAL.md`](USER_MANUAL.md) / [`USER_MANUAL_EN.md`](USER_MANUAL_EN.md)，包含快速入门、五大工坊核心玩法、快捷键速查表及常见问题排查。
- 🌐 **外部链接直跳默认浏览器**：
  - 拦截所有外部网页跳转（GitHub 仓库、使用手册、版本发布页等），统一由 Windows 系统默认浏览器（Chrome / Edge 等）唤起打开，彻底杜绝在内嵌窗口加载网页。
- 🔄 **关于面板版本号动态同步与文案精简**：
  - 设置中心关于页面动态读取系统当前版本号，彻底解决版本显示滞后问题。
  - 精简去除了过度的宣传文案，呈现极简纯净的本地工具箱体验。

---

## 🌟 v1.3.1 精简与体验优化 / What's New in v1.3.1

- 🧹 **模块精简与去冗余 (Module Streamlining)**：
  - 完全移除低频且冗余的「财务大写与日常实用」标签页（包含人民币财务大写、字数统计、身份证校验、JSON/Base64/Hash/时间戳等散落功能）。
  - 日常与便民工坊全面聚焦于三大核心高频刚需工具：**证件照换底排版**、**艺术二维码与识码**、**文章与文本对比**，界面更加纯净聚焦。

---

## 🌟 v1.3.0 重大更新亮点 / What's New in v1.3.0

- 🏎️ **全链路 60~120 FPS 极速丝滑引擎 (Fluid Performance Engine)**：
  - **Chromium GPU 硬件加速全开**：激活 `--enable-gpu-rasterization` 与 `--enable-zero-copy`，矢量图标群与高清图片直通显卡显存渲染，绕过 Intel/AMD 核显驱动黑名单限制。
  - **Canvas 2D 独立进程光栅化**：水印批处理、智能微距比对、证件照排版及 AI 选区绘制直接由 GPU 独立着色器驱动，消除高负荷 CPU 丢帧。
- ⚡ **视口虚拟化渲染与图层硬件合成 (DOM Virtualization & Composited Layers)**：
  - 队列任务列表引入 `content-visibility: auto` 视口裁剪，长列表（50~200+ 任务并发）渲染性能暴增 400%+，仅绘制可视区域节点。
  - 弹窗系统（快捷键指南、偏好设置、Squoosh 对比）与操作浮层升级为独立 GPU 合成图层（`translate3d` 纯显卡硬件加速），彻底消除重绘拖影。
- 🧊 **React 18 并发调度无阻塞切页 (Non-Blocking Concurrent Transitions)**：
  - 核心模块跳转引入 `startTransition`，点击侧边栏与工具瞬时高亮反馈，重型子组件树异步并发加载，告别切页掉帧微卡顿。
- 🎯 **高频交互 RAF 逐帧对齐 (VSync Rate Throttling)**：
  - 画质微距对比 (Squoosh 模式) 滑块拖拽与缩放平移改由 `requestAnimationFrame` 调度，严格对齐 60Hz/120Hz/144Hz 屏幕刷新率，电竞级高回报率鼠标拖拽操作丝滑贴手。

---

## 🌟 v1.2.0 重大更新亮点 / What's New in v1.2.0

- ⚡ **全局快捷键与效率系统 (Productivity Shortcuts)**：
  - 核心快捷键：`Ctrl + Enter` (执行当前操作)、`Ctrl + S` (一键快速下载结果，拦截默认网页另存)、`Ctrl + 1~5` (五大模块瞬间切换)、`Ctrl + ,` (系统偏好设置)、`Ctrl + /` (呼出/隐藏快捷键速查面板)。
  - 全局智能剪贴板（`Ctrl + V`）：在任意界面按 `Ctrl + V` 自动识别图片并智能分发至图像压缩/AI/证件照等当前工坊；文本自动填入文章比对。
- 🔗 **全功能跨工具无损联动流 (Tool Chaining / Pipeline)**：
  - 彻底打破功能孤岛，新增内存级零拷贝流转总线（`toolBus`），各工具输出卡片全面集成 **“发送至 (Send to...)”** 快捷通道。
  - 支持 AI 抠图 $\to$ 证件照/图片压缩、音视频字幕/OCR $\to$ 文章比对校对、视频音频剥离 $\to$ 截取/转码/卡拉OK伴奏，全程内存 `Blob` 零磁盘冗余读写。
- 🛡️ **Python 守护进程自愈主管 (Process Resiliency Supervisor)**：
  - Electron 主进程内嵌后端健康守护监控与崩溃自愈拉起机制（指数退避重启，最多 5 次），前端 API 网络拦截器在进程闪退或网络重连时自动透明重试，彻底解决后端中断导致的白屏无响应。
- 🚀 **批量并发调度池与微距画质对比 (Batch Concurrency & Quality Compare)**：
  - 批量图片与音频转码支持多 Worker 并发队列调度，提供任务级取消/重试、总体进度条与剩余时间预估（ETA），支持一键打包 Zip 导出。
  - 集成 Squoosh 级交互式分屏微距滑动对比，压缩质量细节肉眼可见。

---

## 🌟 v1.1.0 重大更新亮点 / What's New in v1.1.0

- 🤖 **全新 AI 创新工坊三合一**：
  - **智能图像修复画笔 (AI Inpaint Brush)**：基于 IOPaint C++ 双算法（Telea / Navier-Stokes），交互式自由涂抹选区，精准消除照片瑕疵、杂物与水印，附带 Squoosh 交互式滑动对比。
  - **双层可搜索 PDF 制作 (Searchable PDF Maker)**：深度融合 Umi-OCR 与 Tesseract 引擎，将纯图片扫描件转换为保留原始高保真版面、底层覆盖透明文字图层的双层 PDF，支持全文复制与检索。
  - **音视频字幕工坊 (Audio & Video Subtitle Studio)**：基于 Buzz Web Audio VAD 语音断句对齐，自动切分音视频语音区间，生成毫秒级时间轴并导出标准 SRT、VTT 与 TXT 字幕。
- 📝 **文章与文本对比 (Article & Text Diff)**：全新双栏文章修订对比工具，支持段落与字符级精细对比、中英双语范文一键载入、折叠未修改内容与统计增删变动。
- 🎨 **主题系统重构 (White & Dark 独立调色)**：仅保留高雅**纯白 (White)**与极简**深黑 (Dark)**模式，底层分离存储自定义调色方案（窗口背景、卡片容器、强调色、文本、边框轮廓），切换模式永不丢失个人配方。
- 🔤 **标准英文高清晰度字体**：全面支持 5 款清晰 UI 字体（System Default、Inter、Roboto、Segoe UI、Monospace），配备标准化英文字样排版实时预览。
- 🛡️ **安全设置草稿流 (Draft/Commit)**：修改设置项即时预览生效；未点击“保存设置”前退出将弹出确认提示，杜绝误触丢弃修改。
- 📴 **纯本地离线保护**：全功能支持无网单机运行，零 API Key 依赖，绝不向第三方上传任何用户隐私与文件内容。

---

## ✨ 核心功能全景 / Features Matrix

### 📄 1. PDF 与文档工坊 (Document & PDF)
- **PDF 1:1 原版排版在线工作台**：原位文字就地改字、段落增删、遮盖涂抹，锁定原始排版完全不跑偏。
- **Word 转 PDF (超清/多档位)**：轻量 (96 DPI)、标准 (150 DPI)、打印级 (300 DPI) 三档导出；独创**智能字体流裁剪**算法，解决特殊字形体积膨胀。
- **PDF 转 Word (高保真还原)**：深度解析排版布局、表格结构与公式。
- **PDF 页面管理**：拖拽多文档合并、页码区间拆分、半透明防伪水印添加与 AES 高强度加密保护。

### 🖼️ 2. 图片与视觉工坊 (Image & Visual)
- **智能图片无损压缩**：视觉无损压缩算法，在保留极致画质前提下最高节省 90% 存储。
- **Apple HEIC 转码**：一键将 iPhone 实况照片/HEIC 转换为通用 JPG/PNG/WebP。
- **全格式图片互转**：WebP、PNG、JPG、BMP、TIFF、AVIF 多格式批量无损转换。
- **元数据抹除 (EXIF Stripper)**：一键抹除照片拍摄 GPS 定位、设备型号等隐私信息。

### 🎵 3. 音频与声学工坊 (Audio & Sound)
- **全格式音频互转**：MP3、WAV、FLAC、AAC、OGG、M4A 批量极速转换。
- **母带级音质调校**：自由重采样率 (44.1kHz ~ 96kHz)、位深 (16-bit / 24-bit / 32-bit float) 与声道切换。
- **音频变速变调**：独立调节播放速率与音高频移。
- **可视化声波发生器**：生成标准正弦波、方波、粉红噪声与白噪声，实时可视化渲染音频波形。

### 🤖 4. AI 智能创新工坊 (AI Magic Studio)
- **AI 智能消除笔 (Inpaint Brush)**：涂抹抹除水印、路人、瑕疵，实时双算法修复。
- **双层可搜索 PDF 制作**：扫描件一键生成可划词检索的 PDF。
- **音视频字幕提取工坊**：本地语音活性检测 (VAD)，生成标准 SRT/VTT 字幕。
- **AI 发丝级人像抠图**：复杂背景秒级透明化抠图。
- **AI 4K/8K 超分辨率重构**：老照片与低清图像纹理超清增强放大。

### 🛠️ 5. 日常生活与实用工具 (Utility & Dev)
- **文章与文本对比 (Article Diff)**：双栏排版、字符精细对比、中英双语范文。
- **证件照换底与 6 寸排版**：标准一寸/二寸换底（红白蓝灰）及 6 寸相纸自动拼版。
- **个性化艺术二维码**：炫彩渐变色、中心嵌入 Logo、名片/WiFi 一键生成与离线识码。
- **财务与开发利器**：人民币财务大写换算、字数中英文统计、JSON 校验与常用编码转换。

---

## 🚀 下载与安装 / Download & Install

### 下载预编译安装包 (Windows)
前往 [GitHub Releases](https://github.com/LEESC88/XC_OmniBox/releases/latest) 下载最新的 Windows 64 位安装程序：
- **`XC_OmniBox-Setup-1.2.0.exe`**

---

## 🛠️ 本地开发环境搭建 / Development Setup

### 前置要求
- Node.js 18+ & npm
- Python 3.11+
- Windows 10 / 11

### 1. 克隆代码仓库
```bash
git clone https://github.com/LEESC88/XC_OmniBox.git
cd XC_OmniBox
```

### 2. 安装前端与 Electron 依赖
```bash
npm install
npm --prefix frontend install
```

### 3. 配置 Python 后端环境
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd ..
```

### 4. 运行本地开发
```bash
# 桌面客户端全量运行 (前端 + 后端服务 + Electron 宿主)
npm run dev:electron

# 仅前端与后端运行 (浏览器访问 http://localhost:3000)
npm run dev
```

### 5. 打包构建
```bash
# 前端静态生产打包
npm run build:frontend

# 完整打包发布安装包
npm run dist
```

---

## 📜 开源协议 / License

本项目基于 [MIT License](LICENSE) 开源。欢迎提交 Issue 与 Pull Request 共同完善！
