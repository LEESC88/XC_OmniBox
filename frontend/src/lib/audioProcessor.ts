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

/**
 * 9. 智能人声清晰化、去低频底噪与动态均衡 (Voice Clarity & Studio Compressor)
 * 采用 Web Audio 原生 BiquadFilterNode (100Hz 高通切除空调轰鸣/风噪 + 3kHz 语音共振峰提升)
 * 配合 DynamicsCompressorNode (广播级动态范围压缩，压制突发爆音并提亮微弱语音)
 */
export async function enhanceVoiceClarity(
  audioBuffer: AudioBuffer,
  options: {
    filterRumble?: boolean;
    boostPresence?: boolean;
    compressDynamics?: boolean;
  } = {}
): Promise<AudioBuffer> {
  const { filterRumble = true, boostPresence = true, compressDynamics = true } = options;

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const length = audioBuffer.length;

  const offlineCtx = new OfflineAudioContext(channels, length, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;

  let lastNode: AudioNode = source;

  // 1. 低频滤除 (Highpass Filter 100Hz, Q=0.707 切除空调轰鸣与手持风噪)
  if (filterRumble) {
    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 100;
    highpass.Q.value = 0.707;
    lastNode.connect(highpass);
    lastNode = highpass;
  }

  // 2. 人声存在感与清晰度增强 (Peaking Filter 3000Hz, Gain +3.5dB)
  if (boostPresence) {
    const presence = offlineCtx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3000;
    presence.Q.value = 1.0;
    presence.gain.value = 3.5;
    lastNode.connect(presence);
    lastNode = presence;
  }

  // 3. 广播级压缩器 (DynamicsCompressorNode 均衡微弱声与大音量)
  if (compressDynamics) {
    const compressor = offlineCtx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;
    lastNode.connect(compressor);
    lastNode = compressor;
  }

  lastNode.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
}

/**
 * 10. 音频硬件级离线变速 (0.5x ~ 2.0x 变速播放与导出)
 */
export async function changeAudioSpeed(
  audioBuffer: AudioBuffer,
  speed: number = 1.0
): Promise<AudioBuffer> {
  if (speed === 1.0) return audioBuffer;

  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const newLength = Math.max(1, Math.floor(audioBuffer.length / speed));

  const offlineCtx = new OfflineAudioContext(channels, newLength, sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.playbackRate.value = speed;

  source.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
}

/**
 * 11. 趣味音频倒放 (Reverse Audio Buffer)
 */
export function reverseAudioBuffer(audioBuffer: AudioBuffer): AudioBuffer {
  const ctx = getAudioContext();
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;

  const newBuffer = ctx.createBuffer(channels, length, sampleRate);

  for (let c = 0; c < channels; c++) {
    const src = audioBuffer.getChannelData(c);
    const dst = newBuffer.getChannelData(c);
    for (let i = 0; i < length; i++) {
      dst[i] = src[length - 1 - i];
    }
  }

  return newBuffer;
}

/**
 * 12. 伴奏提取与人声消除 (Center Channel Vocal Cut with Bass Preservation)
 * 原理：大部分流行音乐主唱位于声场正中央 (L ≈ R)。
 * 通过 L - R 差分相位抵消消除正中央人声；
 * 同时用一阶低通滤波保留 200Hz 以下低音 (底鼓与贝斯)，避免消人声后声音单薄。
 */
export function extractKaraokeAccompaniment(
  audioBuffer: AudioBuffer,
  bassPreserveHz: number = 180
): AudioBuffer {
  const ctx = getAudioContext();
  const channels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const sampleRate = audioBuffer.sampleRate;

  if (channels < 2) {
    return audioBuffer;
  }

  const leftData = audioBuffer.getChannelData(0);
  const rightData = audioBuffer.getChannelData(1);

  const newBuffer = ctx.createBuffer(2, length, sampleRate);
  const outL = newBuffer.getChannelData(0);
  const outR = newBuffer.getChannelData(1);

  // 简易一阶 RC 低通滤波保留低音
  const dt = 1 / sampleRate;
  const rc = 1 / (2 * Math.PI * bassPreserveHz);
  const alpha = dt / (rc + dt);

  let lowL = 0;
  let lowR = 0;

  for (let i = 0; i < length; i++) {
    const l = leftData[i];
    const r = rightData[i];

    // 低通滤波得到低音频段 (Kick & Bass)
    lowL += alpha * (l - lowL);
    lowR += alpha * (r - lowR);

    // 中高频人声差分消除
    const diff = (l - r) * 0.7;

    outL[i] = Math.max(-1, Math.min(1, diff + lowL));
    outR[i] = Math.max(-1, Math.min(1, -diff + lowR));
  }

  return newBuffer;
}

