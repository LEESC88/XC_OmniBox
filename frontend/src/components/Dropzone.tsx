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
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragOver
              ? "border-blue-500 bg-blue-50/60 scale-[0.99]"
              : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/60 bg-white"
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
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="p-4 bg-blue-50 text-blue-600 rounded-full shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>
            <div>
              <p className="text-base font-medium text-slate-800">{title}</p>
              <p className="text-xs text-slate-400 mt-1">{hint}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              已选文件 ({selectedFiles.length})
            </span>
            <button
              onClick={onClear}
              className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium"
            >
              <X className="w-3.5 h-3.5" /> 重新选择
            </button>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {selectedFiles.map((file, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm border border-slate-100"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <FileIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="truncate font-medium text-slate-700 text-xs">
                    {file.name}
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono flex-shrink-0 ml-2">
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
