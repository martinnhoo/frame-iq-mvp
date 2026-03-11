/**
 * Client-side audio extraction from video files.
 * Converts any video format (MOV, AVI, MKV, etc.) to 16kHz mono WAV
 * compatible with OpenAI Whisper API.
 */

const MAX_WHISPER_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit

/** Encode Float32Array PCM samples into a WAV blob */
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export interface ExtractionProgress {
  phase: "reading" | "decoding" | "resampling" | "encoding";
  percent: number;
}

/**
 * Extract audio from a video/audio file → 16kHz mono WAV File.
 * Works with any format the browser can decode (MP4, MOV, WebM, AVI, etc.)
 */
export async function extractAudioFromFile(
  file: File,
  onProgress?: (p: ExtractionProgress) => void
): Promise<File> {
  onProgress?.({ phase: "reading", percent: 10 });
  const arrayBuffer = await file.arrayBuffer();

  onProgress?.({ phase: "decoding", percent: 30 });
  const audioCtx = new AudioContext();
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch {
    await audioCtx.close();
    throw new Error("Could not decode audio from this file. Try converting to MP4 first.");
  }
  await audioCtx.close();

  onProgress?.({ phase: "resampling", percent: 55 });
  const TARGET_SR = 16000;
  const dur = audioBuffer.duration;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(dur * TARGET_SR), TARGET_SR);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();

  onProgress?.({ phase: "encoding", percent: 85 });
  const wavBlob = encodeWAV(rendered.getChannelData(0), TARGET_SR);
  const wavFile = new File([wavBlob], "audio.wav", { type: "audio/wav" });

  console.log(
    `Audio extracted: ${(wavFile.size / 1024 / 1024).toFixed(1)}MB WAV from ${(file.size / 1024 / 1024).toFixed(1)}MB ${file.name} (${Math.round(dur)}s)`
  );

  onProgress?.({ phase: "encoding", percent: 100 });
  return wavFile;
}

/** Check if a file needs audio extraction (video files or oversized audio) */
export function needsExtraction(file: File): boolean {
  // Always extract from video files (ensures WAV format for Whisper)
  if (file.type.startsWith("video/")) return true;
  // Extract from audio files that are too large
  if (file.type.startsWith("audio/") && file.size > MAX_WHISPER_SIZE) return true;
  // Extract from files with video extensions but no MIME type
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mov", "avi", "mkv", "wmv", "flv", "webm", "mp4", "m4v", "3gp"].includes(ext)) return true;
  return false;
}

export { MAX_WHISPER_SIZE };
