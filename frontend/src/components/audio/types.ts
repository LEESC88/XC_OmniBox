export type AudioToolTab = "trim" | "convert" | "merge" | "extract" | "volume" | "speed" | "karaoke";

export interface MergeTrack {
  id: string;
  file: File;
  name: string;
  size: number;
  duration?: number;
  buffer?: AudioBuffer;
}

export interface AudioResult {
  id: string;
  originalName: string;
  originalSize: number;
  newFilename: string;
  newSize: number;
  blob: Blob;
  duration: number;
}

export interface AudioStudioProps {
  isActive?: boolean;
  incomingFile?: File | null;
  onIncomingFileHandled?: () => void;
}
