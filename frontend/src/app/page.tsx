"use client";

import React, { useState, useEffect } from "react";
import {
  Edit3,
  FileText,
  FileCode2,
  Combine,
  Scissors,
  Stamp,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Server,
} from "lucide-react";
import Dropzone from "@/components/Dropzone";
import EditorWorkspace from "@/components/EditorWorkspace";
import {
  checkHealth,
  convertPdfToWord,
  convertWordToPdf,
  mergePdfs,
  splitPdf,
  addWatermark,
  protectPdf,
  parsePdfForEditor,
  downloadBlob,
  HealthStatus,
} from "@/lib/api";

type TabType =
  | "pdf-edit"
  | "pdf-to-word"
  | "word-to-pdf"
  | "pdf-merge"
  | "pdf-split"
  | "pdf-watermark"
  | "pdf-protect";

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>("pdf-edit");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);

  // PDF 在线编辑器状态
  const [editorData, setEditorData] = useState<{ html: string; title: string } | null>(null);
  const [parsingEditor, setParsingEditor] = useState(false);

  // 参数状态
  const [startPage, setStartPage] = useState<number>(0);
  const [pageRanges, setPageRanges] = useState<string>("");
  const [watermarkText, setWatermarkText] = useState<string>("内部机密 严禁外传");
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkAngle, setWatermarkAngle] = useState<number>(45);
  const [protectPassword, setProtectPassword] = useState<string>("");

  // 轮询检查后端状态
  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await checkHealth();
        setHealth(data);
      } catch (e) {
        setHealth(null);
      }
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setFiles([]);
    setError(null);
    setSuccessMsg(null);
    setEditorData(null);
  };

  // 启动在线编辑工作台
  const handleStartEditor = async () => {
    if (files.length === 0) {
      setError("请先上传需要编辑的 PDF 文件");
      return;
    }
    setParsingEditor(true);
    setError(null);
    try {
      const data = await parsePdfForEditor(files[0]);
      setEditorData({
        html: data.html,
        title: data.title || files[0].name.replace(/\.[^/.]+$/, ""),
      });
    } catch (err: any) {
      setError(err.message || "解析 PDF 进入编辑器失败");
    } finally {
      setParsingEditor(false);
    }
  };

  const handleExecute = async () => {
    if (files.length === 0) {
      setError("请先上传需要处理的文件");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (activeTab === "pdf-to-word") {
        const { blob, filename } = await convertPdfToWord(files[0], startPage);
        downloadBlob(blob, filename);
        setSuccessMsg(`转换成功！已为你自动下载: ${filename}`);
      } else if (activeTab === "word-to-pdf") {
        const { blob, filename } = await convertWordToPdf(files[0]);
        downloadBlob(blob, filename);
        setSuccessMsg(`转换成功！已高保真渲染并下载: ${filename}`);
      } else if (activeTab === "pdf-merge") {
        if (files.length < 2) {
          throw new Error("合并至少需要选择 2 个 PDF 文件");
        }
        const { blob, filename } = await mergePdfs(files);
        downloadBlob(blob, filename);
        setSuccessMsg(`合并成功！已下载: ${filename}`);
      } else if (activeTab === "pdf-split") {
        const { blob, filename } = await splitPdf(files[0], pageRanges || undefined);
        downloadBlob(blob, filename);
        setSuccessMsg(`提取/拆分成功！已下载: ${filename}`);
      } else if (activeTab === "pdf-watermark") {
        const { blob, filename } = await addWatermark(
          files[0],
          watermarkText,
          watermarkOpacity,
          watermarkAngle
        );
        downloadBlob(blob, filename);
        setSuccessMsg(`水印添加成功！已下载: ${filename}`);
      } else if (activeTab === "pdf-protect") {
        if (!protectPassword) {
          throw new Error("请输入要设置的密码");
        }
        const { blob, filename } = await protectPdf(files[0], protectPassword);
        downloadBlob(blob, filename);
        setSuccessMsg(`密码保护设置成功！已下载: ${filename}`);
      }
    } catch (err: any) {
      setError(err.message || "处理过程出现异常");
    } finally {
      setLoading(false);
    }
  };

  // 如果处于在线编辑工作台模式，全屏展示 A4 拟真编辑器
  if (activeTab === "pdf-edit" && editorData) {
    return (
      <main className="min-h-screen py-6 px-3 sm:px-6 max-w-6xl mx-auto flex flex-col items-center">
        <EditorWorkspace
          initialHtml={editorData.html}
          initialTitle={editorData.title}
          onExit={() => setEditorData(null)}
        />
      </main>
    );
  }

  return (
    <main className="min-h-screen py-10 px-4 max-w-5xl mx-auto flex flex-col items-center">
      {/* 顶部导航与状态 */}
      <header className="w-full flex flex-col sm:flex-row items-center justify-between pb-8 mb-8 border-b border-slate-200/80 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>XC_OmniBox</span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-semibold">
                XC 万象箱
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              极简 · 高保真排版 · 300+ DPI 无损 · 零隐私泄漏的全能在线工坊
            </p>
          </div>
        </div>

        {/* 后端状态指示灯 */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-xs">
          <Server className="w-3.5 h-3.5 text-slate-400" />
          {health ? (
            <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Python 引擎已就绪</span>
              {health.engines.windows_word_com_available && (
                <span className="text-slate-400 text-[10px] hidden md:inline">
                  (Word打印级支持)
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>后端连接中...</span>
            </div>
          )}
        </div>
      </header>

      {/* 功能选项卡 Tab (新增 PDF 在线编辑并置首) */}
      <div className="w-full grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-6">
        <button
          onClick={() => handleTabChange("pdf-edit")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
            activeTab === "pdf-edit"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          }`}
        >
          <Edit3 className="w-4 h-4 mb-1.5 text-amber-300" />
          PDF 在线编辑
        </button>

        <button
          onClick={() => handleTabChange("pdf-to-word")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
            activeTab === "pdf-to-word"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          }`}
        >
          <FileText className="w-4 h-4 mb-1.5" />
          PDF 转 Word
        </button>

        <button
          onClick={() => handleTabChange("word-to-pdf")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
            activeTab === "word-to-pdf"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          }`}
        >
          <FileCode2 className="w-4 h-4 mb-1.5" />
          Word 转超清PDF
        </button>

        <button
          onClick={() => handleTabChange("pdf-merge")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
            activeTab === "pdf-merge"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          }`}
        >
          <Combine className="w-4 h-4 mb-1.5" />
          多 PDF 合并
        </button>

        <button
          onClick={() => handleTabChange("pdf-split")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
            activeTab === "pdf-split"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          }`}
        >
          <Scissors className="w-4 h-4 mb-1.5" />
          拆分与提取
        </button>

        <button
          onClick={() => handleTabChange("pdf-watermark")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
            activeTab === "pdf-watermark"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          }`}
        >
          <Stamp className="w-4 h-4 mb-1.5" />
          文字水印
        </button>

        <button
          onClick={() => handleTabChange("pdf-protect")}
          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
            activeTab === "pdf-protect"
              ? "bg-blue-600 text-white border-blue-600 shadow-sm scale-[1.02]"
              : "bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-slate-50"
          }`}
        >
          <Lock className="w-4 h-4 mb-1.5" />
          密码加密
        </button>
      </div>

      {/* 核心工作卡片 */}
      <div className="w-full bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-sm">
        {/* 卡片头部描述 */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-slate-800">
            {activeTab === "pdf-edit" && "PDF 在线直接编辑 (Word级所见即所得)"}
            {activeTab === "pdf-to-word" && "PDF 逆向转 Word (.docx)"}
            {activeTab === "word-to-pdf" && "Word 转 300+ DPI 超清 PDF"}
            {activeTab === "pdf-merge" && "PDF 多文件拼合合并"}
            {activeTab === "pdf-split" && "PDF 页面拆分与范围提取"}
            {activeTab === "pdf-watermark" && "PDF 添加倾斜半透明文字水印"}
            {activeTab === "pdf-protect" && "PDF 权限密码加密保护"}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {activeTab === "pdf-edit" &&
              "直接在网页中像使用 Word 一样打字、修改文字、增删段落、修改表格，编辑完成后一键导出 300+ DPI 高清 PDF 或 Word。"}
            {activeTab === "pdf-to-word" &&
              "基于 pdf2docx 开源重构引擎，精准还原表格、文本排版与内嵌高清图片。"}
            {activeTab === "word-to-pdf" &&
              "以打印级画质渲染输出，保留矢量线条与原图最高清晰度，绝不模糊。"}
            {activeTab === "pdf-merge" &&
              "支持同时拖入 2 个或更多 PDF 文件，按上传顺序拼合成单一 PDF。"}
            {activeTab === "pdf-split" &&
              "可提取单页或按范围抽取指定页面，例如输入 1-3, 5。"}
            {activeTab === "pdf-watermark" &&
              "在文档每页中心渲染自定义半透明防伪文字水印。"}
            {activeTab === "pdf-protect" &&
              "对 PDF 增加 AES 强密码权限保护，未授权无法查看。"}
          </p>
        </div>

        {/* 文件拖拽上传区域 */}
        <div className="mb-6">
          <Dropzone
            accept={activeTab === "word-to-pdf" ? ".docx,.doc" : ".pdf"}
            multiple={activeTab === "pdf-merge"}
            selectedFiles={files}
            onFilesSelected={setFiles}
            onClear={() => setFiles([])}
            title={
              activeTab === "pdf-edit"
                ? "拖入待编辑的 PDF 文件，点击即可进入在线工作台"
                : activeTab === "pdf-merge"
                ? "拖入多个 PDF 文件（按 Ctrl 多选），或点击选择"
                : activeTab === "word-to-pdf"
                ? "拖入 Word 文档 (.docx, .doc)，或点击选择"
                : "拖入 PDF 文档 (.pdf)，或点击选择"
            }
            hint={
              activeTab === "word-to-pdf"
                ? "支持 .docx 或 .doc 格式"
                : activeTab === "pdf-merge"
                ? "支持选中多个 PDF 批量合并"
                : "支持标准 PDF 文档"
            }
          />
        </div>

        {/* 附属参数微调区 */}
        {activeTab === "pdf-split" && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              提取页面范围 (可选，留空则拆分为独立单页)
            </label>
            <input
              type="text"
              placeholder="例如: 1-3, 5"
              value={pageRanges}
              onChange={(e) => setPageRanges(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
        )}

        {activeTab === "pdf-watermark" && (
          <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                水印文字
              </label>
              <input
                type="text"
                value={watermarkText}
                onChange={(e) => setWatermarkText(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                透明度 ({watermarkOpacity})
              </label>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={watermarkOpacity}
                onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                className="w-full mt-2 accent-blue-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                旋转角度 ({watermarkAngle}°)
              </label>
              <select
                value={watermarkAngle}
                onChange={(e) => setWatermarkAngle(parseInt(e.target.value))}
                className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
              >
                <option value={0}>水平 (0°)</option>
                <option value={30}>轻微倾斜 (30°)</option>
                <option value={45}>经典倾斜 (45°)</option>
                <option value={90}>垂直 (90°)</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === "pdf-protect" && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              设置访问查看密码
            </label>
            <input
              type="password"
              placeholder="请输入加密密码"
              value={protectPassword}
              onChange={(e) => setProtectPassword(e.target.value)}
              className="w-full text-xs p-2.5 bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* 状态反馈提示 */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-700 text-xs">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 提交执行按钮 (针对 PDF Edit 专门定制为'进入在线工作台') */}
        {activeTab === "pdf-edit" ? (
          <button
            onClick={handleStartEditor}
            disabled={parsingEditor || files.length === 0}
            className={`w-full py-3.5 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
              parsingEditor || files.length === 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-[0.99]"
            }`}
          >
            {parsingEditor ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在深度解析 PDF 页面排版，请稍候...</span>
              </>
            ) : (
              <>
                <Edit3 className="w-4 h-4 text-amber-300" />
                <span>进入在线 Word 级编辑工作台</span>
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleExecute}
            disabled={loading || files.length === 0}
            className={`w-full py-3.5 px-6 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${
              loading || files.length === 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-[0.99]"
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>正在处理中，请稍候...</span>
              </>
            ) : (
              <>
                <span>立即执行并自动下载</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 底部隐私与技术说明 */}
      <footer className="mt-8 text-center text-xs text-slate-400 space-y-1">
        <p>🔒 隐私保证：所有文档处理在独立临时工作区中执行，下载后自动彻底销毁</p>
        <p>XC_OmniBox (XC 万象箱) · Next.js 14 + Python FastAPI · 100% 免费开源</p>
      </footer>
    </main>
  );
}
