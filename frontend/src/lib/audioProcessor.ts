import { Mp3Encoder } from "@breezystack/lamejs";

// 获取或复用浏览器 AudioContext
let sharedAudioCtx: AudioContext | null = null;
export function getAudioContext(): AudioContext {
  if (!sharedAudioCtx && typeof window !== "undefined") {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioCtx = new AudioCtxClass();
  }
  return sharedAudioCtx!;
}

// 格式化时间 (秒 -> 00:00.0)
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00.0";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const tenths = Math.floor((seconds % 1) * 10);
  const mm = mins.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");
  return `${mm}:${ss}.${tenths}`;
}

/**
 * 1. 解码任意音频文件 (或视频文件中的音轨) 为 AudioBuffer
 * 浏览器底层支持: MP3, WAV, AAC, M4A, OGG, FLAC, 以及 MP4/MOV/WebM 中的音轨
 */
export async function decodeAudioFile(file: File | Blob): Promise<AudioBuffer> {
  const ctx = getAudioContext();
  const arrayBuffer = await file.arrayBuffer();

  // 处理 decodeAudioData promise 与 callback 两种规范的兼容
  return new Promise<AudioBuffer>((resolve, reject) => {
    ctx.decodeAudioData(
      arrayBuffer.slice(0),
      (decoded) => resolve(decoded),
      (err) => reject(new Error("音频解码失败，请确保文件包含有效音轨: " + err))
    );
  });
}

/**
 * 2. 提取音频波形数据点 (用于 Canvas/SVG 可视化)
 */
export function extractAudioPeaks(audioBuffer: AudioBuffer, numPeaks: number = 300): number[] {
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const blockSize = Math.floor(totalSamples / numPeaks);
  const peaks: number[] = [];

  for (let i = 0; i < numPeaks; i++) {
    const start = i * blockSize;
    let max = 0;
    for (let j = 0; j < blockSize; j++) {
      const val = Math.abs(channelData[start + j] || 0);
      if (val > max) max = val;
    }
    peaks.push(max);
  }

  // 归一化到 0 ~ 1.0
  const maxPeak = Math.max(...peaks, 0.01);
  return peaks.map((p) => Math.min(1.0, p / maxPeak));
}

/**
 * 3. 音频波形裁剪与淡入淡出
 */
export function trimAudioBuffer(
  audioBuffer: AudioBuffer,
  startSec: number,
  endSec: number,
  fadeInSec: number = 0,
  fadeOutSec: number = 0
): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = audioBuffer.sampleRate;
  const channels = audioBuffer.numberOfChannels;

  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(audioBuffer.length, Math.floor(endSec * sampleRate));
  const newLength = Math.max(1, endSample - startSample);

  const newBuffer = ctx.createBuffer(channels, newLength, sampleRate);

  const fadeInSamples = Math.floor(fadeInSec * sampleRate);
  const fadeOutSamples = Math.floor(fadeOutSec * sampleRate);

  for (let c = 0; c < channels; c++) {
    const sourceData = audioBuffer.getChannelData(c);
    const targetData = newBuffer.getChannelData(c);

    for (let i = 0; i < newLength; i++) {
      let sample = sourceData[startSample + i] || 0;

      // 淡入处理
      if (fadeInSamples > 0 && i < fadeInSamples) {
        const factor = i / fadeInSamples;
        sample *= factor;
      }

      // 淡出处理
      if (fadeOutSamples > 0 && i >= newLength - fadeOutSamples) {
        const remaining = newLength - i;
        const factor = Math.max(0, remaining / fadeOutSamples);
        sample *= factor;
      }

      targetData[i] = sample;
    }
  }

  return newBuffer;
}

/**
 * 4. 多音频首尾无缝拼接合并
 */
export function concatAudioBuffers(buffers: AudioBuffer[]): AudioBuffer {
  if (buffers.length === 0) throw new Error("没有可拼接的音频片段");
  if (buffers.length === 1) return buffers[0];

  const ctx = getAudioContext();
  const sampleRate = buffers[0].sampleRate;
  const maxChannels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);

  const mergedBuffer = ctx.createBuffer(maxChannels, totalLength, sampleRate);

  let offset = 0;
  for (const buf of buffers) {
    for (let c = 0; c < maxChannels; c++) {
      const sourceChannel = c < buf.numberOfChannels ? c : 0;
      const sourceData = buf.getChannelData(sourceChannel);
      const targetData = mergedBuffer.getChannelData(c);
      targetData.set(sourceData, offset);
    }
    offset += buf.length;
  }

  return mergedBuffer;
}

/**
 * 5. 音频音量增益与峰值防破音标准化 (Peak Normalization)
 */
export function adjustVolumeAndNormalize(
  audioBuffer: AudioBuffer,
  gainFactor: number = 1.0,
  normalize: boolean = false
): AudioBuffer {
  const ctx = getAudioContext();
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;

  const newBuffer = ctx.createBuffer(channels, length, sampleRate);

  // 如果需要标准化，先扫描全局最高绝对峰值
  let peak = 0.0001;
  if (normalize) {
    for (let c = 0; c < channels; c++) {
      const data = audioBuffer.getChannelData(c);
      for (let i = 0; i < length; i++) {
        const val = Math.abs(data[i]);
        if (val > peak) peak = val;
      }
    }
  }

  // 计算最终缩放系数 (若标准化，拉满至 -0.1 dB 即 0.988)
  const normScale = normalize ? 0.988 / peak : 1.0;
  const finalMultiplier = normScale * gainFactor;

  for (let c = 0; c < channels; c++) {
    const src = audioBuffer.getChannelData(c);
    const dst = newBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      const val = src[i] * finalMultiplier;
      // 限制在 -1.0 ~ 1.0 之间防止失真
      dst[i] = Math.max(-1.0, Math.min(1.0, val));
    }
  }

  return newBuffer;
}

/**
 * 6. 纯前端无损 WAV 编码器 (16-bit PCM RIFF)
 */
export function encodeWavBlob(audioBuffer: AudioBuffer): Blob {
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;

  const numSamples = audioBuffer.length;
  const dataByteLength = numSamples * blockAlign;
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);

  // 辅助写入 ASCII 字符
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF 标头
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(8, "WAVE");

  // fmt 子块
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // Byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data 子块
  writeString(36, "data");
  view.setUint32(40, dataByteLength, true);

  // 交叉写入多声道 16-bit PCM 数据
  let offset = 44;
  const channelsData: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channelsData.push(audioBuffer.getChannelData(c));
  }

  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channelsData[c][i];
      sample = Math.max(-1, Math.min(1, sample));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/**
 * 7. 专业级 LAME MP3 纯前端分块编码器
 */
export async function encodeMp3Blob(audioBuffer: AudioBuffer, kbps: number = 192): Promise<Blob> {
  const channels = Math.min(2, audioBuffer.numberOfChannels);
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const encoder = new Mp3Encoder(channels, sampleRate, kbps);

  // 浮点转 Int16
  const floatToInt16 = (float32: Float32Array): Int16Array => {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
  };

  const leftInt16 = floatToInt16(audioBuffer.getChannelData(0));
  const rightInt16 = channels > 1 ? floatToInt16(audioBuffer.getChannelData(1)) : null;

  const mp3Chunks: Uint8Array[] = [];
  const chunkSize = 1152 * 50; // 分块防止占用超大连续内存

  for (let i = 0; i < length; i += chunkSize) {
    const leftChunk = leftInt16.subarray(i, i + chunkSize);
    let buf: Uint8Array;
    if (channels === 2 && rightInt16) {
      const rightChunk = rightInt16.subarray(i, i + chunkSize);
      buf = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      buf = encoder.encodeBuffer(leftChunk);
    }
    if (buf.length > 0) {
      mp3Chunks.push(new Uint8Array(buf));
    }
  }

  const endBuf = encoder.flush();
  if (endBuf.length > 0) {
    mp3Chunks.push(new Uint8Array(endBuf));
  }

  return new Blob(mp3Chunks as any, { type: "audio/mp3" });
}

/**
 * 8. 统一导出辅助函数
 */
export async function exportAudioBuffer(
  audioBuffer: AudioBuffer,
  format: "mp3" | "wav",
  kbps: number = 192
): Promise<{ blob: Blob; ext: string }> {
  if (format === "wav") {
    const blob = encodeWavBlob(audioBuffer);
    return { blob, ext: "wav" };
  } else {
    const blob = await encodeMp3Blob(audioBuffer, kbps);
    return { blob, ext: "mp3" };
  }
}
