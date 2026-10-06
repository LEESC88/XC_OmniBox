/**
 * 跨工具联动流 (Tool Chaining / Inter-Tool Bus)
 * 支持在不同工具模块之间零拷贝传递内存 Blob / File / 纯文本，彻底打破功能孤岛
 */

export interface ToolTransferPayload {
  file?: File;
  files?: File[];
  blob?: Blob;
  filename?: string;
  text?: string;
  sourceTitle?: string;
  meta?: Record<string, any>;
}

export interface ToolTarget {
  module: "document" | "spreadsheet" | "image" | "audio" | "utilities" | "ai";
  tab?: string;
  targetSide?: "original" | "modified"; // 专用于文章/文本对比
}

export type ToolBusListener = (event: { target: ToolTarget; payload: ToolTransferPayload }) => void;

class ToolEventBus {
  private listeners: Set<ToolBusListener> = new Set();
  private pendingEvent: { target: ToolTarget; payload: ToolTransferPayload } | null = null;

  /**
   * 发送载荷至目标工具
   */
  emit(target: ToolTarget, payload: ToolTransferPayload) {
    const event = { target, payload };
    this.pendingEvent = event;
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.error("[ToolBus] Listener error:", e);
      }
    });
  }

  /**
   * 监听跨工具流转事件
   */
  subscribe(listener: ToolBusListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 读取并清空待处理事件
   */
  consumePending() {
    const pending = this.pendingEvent;
    this.pendingEvent = null;
    return pending;
  }
}

export const toolBus = new ToolEventBus();

/**
 * 将 Blob 转化为 File 实例的通用辅助函数
 */
export function blobToFile(blob?: Blob | null, filename: string = "transferred_media.bin"): File | null {
  if (!blob) return null;
  if (blob instanceof File) return blob;
  return new File([blob], filename, {
    type: blob.type || "application/octet-stream",
    lastModified: Date.now(),
  });
}
