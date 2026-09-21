"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, File as FileIcon, X } from "lucide-react";

interface DropzoneProps {
  accept: string;
  multiple?: boolean;
  onFilesSelected: (files: File[]) => void;
  selectedFiles: File[];
  onClear: () => void;
  title?: string;
  hint?: string;
}

export default function Dropzone({
  accept,
  multiple = false,
  onFilesSelected,
  selectedFiles,
  onClear,
  title = "拖拽文件到此处，或点击上传",
  hint = "支持相应格式文档",
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFilesSelected(multiple ? files : [files[0]]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(multiple ? files : [files[0]]);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  return (
    <div className="w-full">
      {selectedFiles.length === 0 ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`group relative border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center cursor-pointer transition-all duration-300 select-none ${
            isDragOver
              ? "border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 scale-[0.99] shadow-coconut-md ring-4 ring-amber-400/20"
              : "border-[#D2BCAB] dark:border-[#4D392E] hover:border-amber-500 dark:hover:border-amber-400 bg-[#FAF1E8]/75 dark:bg-[#251E1A]/70 hover:bg-[#F4E6D8]/85 dark:hover:bg-[#2E2520] shadow-2xs"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="flex flex-col items-center justify-center space-y-3.5">
            <div className={`p-4 rounded-2xl transition-all duration-300 shadow-sm ${
              isDragOver
                ? "bg-amber-500 text-white scale-110"
                : "bg-[#FAF1E8] dark:bg-[#2E2520] text-coconut-800 dark:text-amber-400 border border-[#D2BCAB] dark:border-[#4D392E] group-hover:scale-105 group-hover:border-amber-500 group-hover:text-amber-600"
            }`}>
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-sm sm:text-base font-semibold text-coconut-900 dark:text-darkbg-text tracking-tight">
                {title}
              </p>
              <p className="text-xs text-coconut-600 dark:text-darkbg-muted mt-1">
                {hint}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#FAF1E8] dark:bg-[#251E1A] border border-[#D2BCAB] dark:border-[#4D392E] rounded-2xl p-4 sm:p-5 shadow-coconut-sm backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-coconut-800 dark:text-darkbg-muted flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              已选文件 ({selectedFiles.length})
            </span>
            <button
              onClick={onClear}
              className="text-xs text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 flex items-center gap-1 font-semibold px-2.5 py-1 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-900 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> 重新选择
            </button>
          </div>
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 sm:p-3 bg-white/90 dark:bg-[#2F2520] rounded-xl text-sm border border-[#E8DDCE] dark:border-[#362921] transition-all hover:border-[#DBC8B5] dark:hover:border-[#44342A] shadow-2xs"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <FileIcon className="w-4 h-4 text-coconut-600 dark:text-palm-400 flex-shrink-0" />
                  <span className="truncate font-medium text-coconut-900 dark:text-darkbg-text text-xs">
                    {file.name}
                  </span>
                </div>
                <span className="text-xs text-coconut-600 dark:text-darkbg-muted font-mono flex-shrink-0 ml-2 font-semibold">
                  {formatSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
