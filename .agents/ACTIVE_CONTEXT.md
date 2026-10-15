# Active Context (v1.6.1 懒加载提速、工坊收敛与 PDF 乱码修复)

## 1. 当前进度
- [x] 服务级按需懒加载：消除 `ipcHandlers.js` / `main.js` 顶层同步二进制库阻塞，按需实例化 Service。
- [x] 工坊收敛：扫描与文字并入【文档与文字工坊】（11工具），升级【PDF 加密解密与权限管理】。
- [x] 修复 PDF 预览方框乱码：开启 `disableFontFace: true` 矢量光栅化解析，集成 CMap 与系统 CJK 字库。
- [x] 全量冒烟与极端边界回归：41 项核心功能测试 100% 通过；前端 `tsc` 与 Next.js 静态打包 100% 成功。

## 2. 核心契约与变更
- `document:unlock-pdf` -> `{ buffer, filename, pageCount }` (密码解密/权限移除/抹除元数据)
- `document:render-pdf-pages` -> `disableFontFace: true` + CMap 动态寻址 + Windows CJK 字体池注册
- 保持所有 27 个 IPC Channel 接口签名 100% 不变。

## 3. 已闭环边界问题
- Node.js + @napi-rs/canvas 无 DOM 导致的 PDF 内嵌字体 Tofu 方框字乱码缺陷闭环。
- 41/41 冒烟用例全绿，零异常。
