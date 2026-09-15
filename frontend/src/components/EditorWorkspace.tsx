"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Download,
  FileDown,
  ArrowLeft,
  Loader2,
  Table as TableIcon,
  Palette,
  Highlighter,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import { exportEditorPdf, exportEditorDocx, downloadBlob } from "@/lib/api";

interface EditorWorkspaceProps {
  initialHtml: string;
  initialTitle: string;
  onExit: () => void;
}

export default function EditorWorkspace({
  initialHtml,
  initialTitle,
  onExit,
}: EditorWorkspaceProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [docTitle, setDocTitle] = useState(initialTitle || "未命名文档");
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [loadingDocx, setLoadingDocx] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = initialHtml;
      updateWordCount();
    }
  }, [initialHtml]);

  const updateWordCount = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || "";
      setWordCount(text.trim().replace(/\s+/g, "").length);
    }
  };

  const executeCommand = (command: string, value: string = "") => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      editorRef.current.focus();
    }
    updateWordCount();
  };

  const handleHeadingChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "p") {
      executeCommand("formatBlock", "<p>");
    } else {
      executeCommand("formatBlock", `<${val}>`);
    }
  };

  const insertTable = () => {
    const tableHtml = `
      <table border="1" style="width:100%; border-collapse:collapse; margin:12px 0;">
        <thead>
          <tr style="background-color:#f8fafc;">
            <th style="border:1px solid #cbd5e1; padding:8px;">列 1</th>
            <th style="border:1px solid #cbd5e1; padding:8px;">列 2</th>
            <th style="border:1px solid #cbd5e1; padding:8px;">列 3</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #cbd5e1; padding:8px;">数据 A</td>
            <td style="border:1px solid #cbd5e1; padding:8px;">数据 B</td>
            <td style="border:1px solid #cbd5e1; padding:8px;">数据 C</td>
          </tr>
        </tbody>
      </table>
    `;
    executeCommand("insertHTML", tableHtml);
  };

  const showToast = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const handleExportPdf = async () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setLoadingPdf(true);
    try {
      const { blob, filename } = await exportEditorPdf(html, docTitle);
      downloadBlob(blob, filename);
      showToast("success", `已高保真渲染并导出 PDF: ${filename}`);
    } catch (err: any) {
      showToast("error", err.message || "导出 PDF 失败");
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleExportDocx = async () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setLoadingDocx(true);
    try {
      const { blob, filename } = await exportEditorDocx(html, docTitle);
      downloadBlob(blob, filename);
      showToast("success", `已成功导出 Word 文档: ${filename}`);
    } catch (err: any) {
      showToast("error", err.message || "导出 Word 失败");
    } finally {
      setLoadingDocx(false);
    }
  };

  return (
    <div className="w-full flex flex-col items-center bg-slate-100/70 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* 顶部控制与工具栏 */}
      <div className="w-full bg-white border-b border-slate-200/90 px-4 py-3 sticky top-0 z-20 shadow-xs">
        {/* 第一行：标题栏与导出按钮 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onExit}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="返回上传"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <input
                type="text"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                className="font-semibold text-slate-800 text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:bg-blue-50/40 px-1.5 py-0.5 rounded outline-none transition-all"
                title="点击修改文件名"
              />
            </div>
            <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
              ({wordCount} 字)
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportDocx}
              disabled={loadingDocx}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
            >
              {loadingDocx ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
              )}
              <span>导出为 Word</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={loadingPdf}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1.5 shadow-sm shadow-blue-500/20 transition-all active:scale-95 disabled:opacity-50"
            >
              {loadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>导出为超清 PDF</span>
            </button>
          </div>
        </div>

        {/* 第二行：Word 级格式排版工具条 */}
        <div className="flex flex-wrap items-center gap-1 pt-2.5 text-slate-700">
          {/* 撤销 / 重做 */}
          <button
            onClick={() => executeCommand("undo")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="撤销 (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("redo")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="重做 (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-slate-200 mx-1" />

          {/* 标题级别 */}
          <select
            onChange={handleHeadingChange}
            defaultValue="p"
            className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 outline-none focus:border-blue-500 text-slate-700"
          >
            <option value="p">正文文本</option>
            <option value="h1">大标题 (H1)</option>
            <option value="h2">中标题 (H2)</option>
            <option value="h3">小标题 (H3)</option>
          </select>

          <div className="w-[1px] h-4 bg-slate-200 mx-1" />

          {/* 字体样式 */}
          <button
            onClick={() => executeCommand("bold")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 font-bold"
            title="加粗 (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("italic")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 italic"
            title="斜体 (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("underline")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 underline"
            title="下划线 (Ctrl+U)"
          >
            <Underline className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("strikeThrough")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-700 line-through"
            title="删除线"
          >
            <Strikethrough className="w-4 h-4" />
          </button>

          {/* 文字颜色与高亮 */}
          <label className="p-1.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer flex items-center gap-0.5" title="文字颜色">
            <Palette className="w-4 h-4 text-blue-600" />
            <input
              type="color"
              onChange={(e) => executeCommand("foreColor", e.target.value)}
              className="opacity-0 w-0 h-0"
            />
          </label>
          <label className="p-1.5 hover:bg-slate-100 rounded text-slate-700 cursor-pointer flex items-center gap-0.5" title="背景高亮色">
            <Highlighter className="w-4 h-4 text-amber-500" />
            <input
              type="color"
              defaultValue="#fef08a"
              onChange={(e) => executeCommand("hiliteColor", e.target.value)}
              className="opacity-0 w-0 h-0"
            />
          </label>

          <div className="w-[1px] h-4 bg-slate-200 mx-1" />

          {/* 对齐方式 */}
          <button
            onClick={() => executeCommand("justifyLeft")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="左对齐"
          >
            <AlignLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("justifyCenter")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="居中对齐"
          >
            <AlignCenter className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("justifyRight")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="右对齐"
          >
            <AlignRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("justifyFull")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="两端对齐"
          >
            <AlignJustify className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-slate-200 mx-1" />

          {/* 列表与引用 */}
          <button
            onClick={() => executeCommand("insertUnorderedList")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="无序列表"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("insertOrderedList")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="有序列表"
          >
            <ListOrdered className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("formatBlock", "blockquote")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="引用段落"
          >
            <Quote className="w-4 h-4" />
          </button>
          <button
            onClick={() => executeCommand("insertHorizontalRule")}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600"
            title="插入分割线"
          >
            <Minus className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-slate-200 mx-1" />

          {/* 插入表格 */}
          <button
            onClick={insertTable}
            className="p-1.5 hover:bg-slate-100 rounded text-slate-600 flex items-center gap-1 text-xs"
            title="插入表格"
          >
            <TableIcon className="w-4 h-4 text-emerald-600" />
            <span className="hidden xl:inline text-[11px]">表格</span>
          </button>
        </div>
      </div>

      {/* Toast 提示框 */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg border flex items-center gap-2 text-xs font-medium animate-in fade-in slide-in-from-top-3 ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600" />
          )}
          <span>{toast.msg}</span>
        </div>
      )}

      {/* A4 拟真排版纸张视图 (所见即所得核心编辑区) */}
      <div className="w-full overflow-y-auto py-8 px-2 sm:px-6 flex justify-center max-h-[calc(100vh-220px)]">
        <div
          ref={editorRef}
          contentEditable
          onInput={updateWordCount}
          suppressContentEditableWarning
          className="w-full max-w-[820px] min-h-[1050px] bg-white text-slate-800 p-8 sm:p-14 shadow-lg shadow-slate-300/40 rounded-sm border border-slate-200/80 outline-none leading-relaxed text-sm focus:ring-2 focus:ring-blue-500/20 transition-all font-sans"
          style={{
            minHeight: "1120px",
            wordBreak: "break-word",
          }}
        />
      </div>

      {/* 底部状态条 */}
      <div className="w-full bg-slate-50 border-t border-slate-200 py-2 px-6 flex items-center justify-between text-[11px] text-slate-400">
        <span>💡 提示：支持像 Word 一样直接在此打字、换行、增删段落与调整表格，修改完毕点击右上角一键导出</span>
        <span>A4 纸张排版模式 · 300+ DPI 保真导出</span>
      </div>
    </div>
  );
}
