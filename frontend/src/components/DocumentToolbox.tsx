"use client";

import React, { useState, useEffect } from "react";
import {
  FileCode2,
  FolderArchive,
  Sparkles,
} from "lucide-react";

import ScrollableTabNav from "@/components/ScrollableTabNav";
import OfficeMediaExtractStudio from "@/components/document/OfficeMediaExtractStudio";
import AiMarkdownToWordStudio from "@/components/document/AiMarkdownToWordStudio";
import AiToolbox from "@/components/AiToolbox";
import { useI18n } from "@/lib/i18n";

export type DocTabType =
  | "ai-md-to-word"
  | "office-media-extract"
  | "ai-ocr";

export interface DocumentToolboxProps {
  currentTab?: DocTabType;
  onTabChange?: (tab: DocTabType) => void;
  incomingFiles?: File[];
  onIncomingFilesHandled?: () => void;
}

export default function DocumentToolbox({
  currentTab,
  onTabChange,
  incomingFiles,
  onIncomingFilesHandled,
}: DocumentToolboxProps) {
  const { lang } = useI18n();

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState<DocTabType>(
    currentTab || "ai-md-to-word",
  );

  const [files, setFiles] = useState<File[]>([]);

  // Synchronize external tab switches
  useEffect(() => {
    if (currentTab && currentTab !== activeTab) {
      setActiveTab(currentTab);
      setFiles([]);
    }
  }, [currentTab]);

  // Handle incoming files from clipboard / cross-tool bus
  useEffect(() => {
    if (incomingFiles && incomingFiles.length > 0) {
      setFiles(incomingFiles);
      onIncomingFilesHandled?.();
    }
  }, [incomingFiles]);

  const handleTabSelect = (tabId: DocTabType) => {
    setActiveTab(tabId);
    setFiles([]);
    onTabChange?.(tabId);
  };

  // Tab definitions with localized labels
  const docTabs = [
    {
      id: "ai-md-to-word",
      label: lang === "en" ? "Markdown to Word" : "Markdown 转 Word",
      icon: FileCode2,
    },
    {
      id: "office-media-extract",
      label: lang === "en" ? "Office Media Extractor" : "Office 媒体提取",
      icon: FolderArchive,
    },
    {
      id: "ai-ocr",
      label: lang === "en" ? "Text Recognition (OCR)" : "文字识别 (OCR)",
      icon: Sparkles,
    },
  ];

  return (
    <div className="space-y-5">
      {/* 3 Document & Office Horizontal Sub-tabs Nav */}
      <ScrollableTabNav
        tabs={docTabs}
        activeTab={activeTab}
        onTabChange={(id) => handleTabSelect(id as DocTabType)}
      />

      {activeTab === "ai-md-to-word" ? (
        <AiMarkdownToWordStudio
          incomingFiles={files}
          onIncomingFilesHandled={() => setFiles([])}
        />
      ) : activeTab === "office-media-extract" ? (
        <OfficeMediaExtractStudio
          initialFile={files[0] || null}
          onClearInitialFile={() => setFiles([])}
        />
      ) : (
        <AiToolbox
          currentTab="ai-ocr"
          onTabChange={(id) => handleTabSelect(id as DocTabType)}
          incomingFile={files[0] || null}
          onIncomingFileHandled={() => setFiles([])}
          hideSubTabs={true}
        />
      )}
    </div>
  );
}
