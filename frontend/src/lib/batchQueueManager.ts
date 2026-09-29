import JSZip from "jszip";
import { downloadBlob } from "./api";

export type QueueItemStatus = "waiting" | "processing" | "completed" | "error" | "cancelled";

export interface BatchTaskItem<TInput = any, TOutput = any> {
  id: string;
  name: string;
  size?: number;
  raw: TInput;
  status: QueueItemStatus;
  progress: number; // 0 - 100
  result?: TOutput;
  error?: string;
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
}

export interface BatchProgressSummary {
  total: number;
  completed: number;
  failed: number;
  active: number;
  waiting: number;
  percent: number;
  etaSeconds: number | null;
}

export interface BatchQueueOptions<TInput = any, TOutput = any> {
  concurrency?: number; // 默认 3，取值范围 1 ~ 6
  onProgress?: (summary: BatchProgressSummary) => void;
  onItemUpdate?: (item: BatchTaskItem<TInput, TOutput>) => void;
  signal?: AbortSignal;
}

/**
 * 计算剩余预计时间 (ETA)
 */
export function calculateEta(startTime: number, completedCount: number, totalCount: number): number | null {
  if (completedCount <= 0 || totalCount <= 0 || completedCount >= totalCount) {
    return 0;
  }
  const elapsedMs = Date.now() - startTime;
  if (elapsedMs < 300) return null; // 太短暂不足以推算
  const msPerItem = elapsedMs / completedCount;
  const remainingItems = totalCount - completedCount;
  return Math.max(1, Math.round((msPerItem * remainingItems) / 1000));
}

/**
 * 格式化 ETA 显示
 */
export function formatEta(seconds: number | null, lang: "zh" | "en" = "zh"): string {
  if (seconds === null || seconds === undefined) {
    return lang === "en" ? "Calculating..." : "计算中...";
  }
  if (seconds <= 0) {
    return lang === "en" ? "Done" : "即将完成";
  }
  if (seconds < 60) {
    return lang === "en" ? `~${seconds}s` : `约 ${seconds} 秒`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = seconds % 60;
  return lang === "en" ? `~${mins}m ${remSecs}s` : `约 ${mins} 分 ${remSecs} 秒`;
}

/**
 * 核心并发执行器：基于 Worker Pool 调度任务
 * 支持单任务异常隔离、精准进度追踪、实时 ETA 及取消
 */
export async function executeBatchQueue<TInput, TOutput>(
  items: BatchTaskItem<TInput, TOutput>[],
  processor: (
    item: BatchTaskItem<TInput, TOutput>,
    reportProgress: (percent: number) => void,
    signal?: AbortSignal
  ) => Promise<TOutput>,
  options: BatchQueueOptions<TInput, TOutput> = {}
): Promise<{
  items: BatchTaskItem<TInput, TOutput>[];
  summary: BatchProgressSummary;
}> {
  const concurrency = Math.min(6, Math.max(1, options.concurrency || 3));
  const startTime = Date.now();
  const queue = [...items];

  const updateSummary = () => {
    let completed = 0;
    let failed = 0;
    let active = 0;
    let waiting = 0;

    for (const it of items) {
      if (it.status === "completed") completed++;
      else if (it.status === "error" || it.status === "cancelled") failed++;
      else if (it.status === "processing") active++;
      else if (it.status === "waiting") waiting++;
    }

    const total = items.length;
    const finishedCount = completed + failed;
    const percent = total > 0 ? Math.round((finishedCount / total) * 100) : 0;
    const etaSeconds = calculateEta(startTime, completed, total);

    const summary: BatchProgressSummary = {
      total,
      completed,
      failed,
      active,
      waiting,
      percent,
      etaSeconds,
    };

    options.onProgress?.(summary);
    return summary;
  };

  // 初始状态推送
  updateSummary();

  // 待处理任务游标
  let currentIndex = 0;

  const worker = async () => {
    while (currentIndex < queue.length) {
      if (options.signal?.aborted) {
        // 中断处理：将后续未处理的设置为 cancelled
        while (currentIndex < queue.length) {
          const item = queue[currentIndex++];
          if (item.status === "waiting") {
            item.status = "cancelled";
            item.error = "Cancelled by user";
            options.onItemUpdate?.(item);
          }
        }
        break;
      }

      const item = queue[currentIndex++];
      // 仅处理 waiting 状态的项目（支持部分重试）
      if (item.status !== "waiting") continue;

      item.status = "processing";
      item.progress = 0;
      item.startedAt = Date.now();
      options.onItemUpdate?.(item);
      updateSummary();

      try {
        const result = await processor(
          item,
          (pct: number) => {
            item.progress = Math.min(100, Math.max(0, Math.round(pct)));
            options.onItemUpdate?.(item);
          },
          options.signal
        );

        item.status = "completed";
        item.progress = 100;
        item.result = result;
        item.completedAt = Date.now();
        item.durationMs = item.completedAt - (item.startedAt || item.completedAt);
      } catch (err: any) {
        // 单个任务失败进行错误隔离，不影响队列整体
        item.status = "error";
        item.error = err?.message || String(err) || "Processing failed";
        item.completedAt = Date.now();
        item.durationMs = item.completedAt - (item.startedAt || item.completedAt);
      }

      options.onItemUpdate?.(item);
      updateSummary();
    }
  };

  // 启动并发 Worker 线程池
  const activeWorkers: Promise<void>[] = [];
  const workerCount = Math.min(concurrency, queue.length);
  for (let i = 0; i < workerCount; i++) {
    activeWorkers.push(worker());
  }

  await Promise.all(activeWorkers);

  const finalSummary = updateSummary();
  return { items, summary: finalSummary };
}

/**
 * 统一批量导出机制：
 * 1. 优先调用 Electron 原生直接保存到目标文件夹并调起系统管理器
 * 2. 浏览器环境无缝降级为打包 ZIP 压缩包下载
 */
export async function exportBatchFiles(
  items: Array<{ filename: string; blob: Blob }>,
  options: {
    zipName?: string;
    targetFolder?: string;
    lang?: "zh" | "en";
  } = {}
): Promise<{ type: "electron" | "zip"; success: boolean; path?: string; message?: string }> {
  if (items.length === 0) {
    return { type: "zip", success: false, message: "No items to export" };
  }

  const lang = options.lang || "zh";

  // 检测 Electron 原生保存能力
  if (typeof window !== "undefined" && (window as any).electronAPI?.saveBatchFiles) {
    try {
      const fileBuffers = await Promise.all(
        items.map(async (item) => {
          const buffer = await item.blob.arrayBuffer();
          return {
            name: item.filename,
            buffer,
          };
        })
      );

      const res = await (window as any).electronAPI.saveBatchFiles({
        files: fileBuffers,
        targetFolder: options.targetFolder,
      });

      if (res?.success) {
        if ((window as any).electronAPI.openPath && res.folder) {
          (window as any).electronAPI.openPath(res.folder);
        }
        return {
          type: "electron",
          success: true,
          path: res.folder,
          message: lang === "en" ? `Exported ${res.count} files to ${res.folder}` : `已成功保存 ${res.count} 个文件至 ${res.folder}`,
        };
      }
    } catch (e: any) {
      console.warn("Electron native save failed, falling back to ZIP bundle:", e);
    }
  }

  // 纯 Web 环境或降级：JSZip 打包下载
  const zip = new JSZip();
  const nameTracker = new Map<string, number>();

  items.forEach((item) => {
    let name = item.filename;
    if (nameTracker.has(name)) {
      const count = nameTracker.get(name)! + 1;
      nameTracker.set(name, count);
      const parts = name.split(".");
      const ext = parts.pop();
      name = `${parts.join(".")}_(${count}).${ext}`;
    } else {
      nameTracker.set(name, 0);
    }
    zip.file(name, item.blob);
  });

  const zipBlob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  const finalZipName = options.zipName || `batch_export_${Date.now()}.zip`;
  downloadBlob(zipBlob, finalZipName);

  return {
    type: "zip",
    success: true,
    message: lang === "en" ? "Downloaded as ZIP bundle" : "已打包为 ZIP 文件下载",
  };
}
