/**
 * Client-side audio extraction from video files.
 * Converts any video format (MOV, AVI, MKV, etc.) to 16kHz mono WAV
 * compatible with OpenAI Whisper API.
 *
 * Fallback chain:
 * 1. AudioContext.decodeAudioData (fast, works for MP4/WebM)
 * 2. Video element + MediaRecorder capture (handles .mov, HEVC, etc.)
 * 3. Direct file passthrough if ≤ 25MB (Whisper handles many formats)
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
 * Fallback: use a <video> element + MediaRecorder to capture audio.
 * Works for .mov, HEVC, and other formats the browser can play.
 * Requires real-time playback but at accelerated rate where possible.
 */
async function extractViaVideoElement(
  file: File,
  onProgress?: (p: ExtractionProgress) => void
): Promise<File> {
  onProgress?.({ phase: "decoding", percent: 25 });

  const blobUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = blobUrl;
  video.playsInline = true;
  video.preload = "auto";
  video.muted = false; // need audio for capture

  // Wait for metadata
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error("Browser cannot play this video format. Please convert to MP4 and try again."));
    };
    video.load();
  });

  const duration = video.duration;
  console.log(`Video element fallback: duration=${Math.round(duration)}s, extracting audio via MediaRecorder`);

  // Create audio capture pipeline
  const audioCtx = new AudioContext();
  const source = audioCtx.createMediaElementSource(video);
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);

  // Choose best available audio format
  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : MediaRecorder.isTypeSupported("audio/webm")
    ? "audio/webm"
    : "audio/mp4";

  const recorder = new MediaRecorder(dest.stream, { mimeType });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  return new Promise<File>((resolve, reject) => {
    let progressInterval: ReturnType<typeof setInterval>;

    recorder.onstop = async () => {
      clearInterval(progressInterval);
      URL.revokeObjectURL(blobUrl);
      await audioCtx.close();

      onProgress?.({ phase: "encoding", percent: 90 });

      const blob = new Blob(chunks, { type: mimeType });
      const ext = mimeType.includes("webm") ? "webm" : "mp4";
      const audioFile = new File([blob], `audio.${ext}`, { type: mimeType });

      console.log(
        `Audio captured via video element: ${(audioFile.size / 1024 / 1024).toFixed(1)}MB ${ext} from ${Math.round(duration)}s video`
      );

      // If captured audio is still too large, try WAV resampling
      if (audioFile.size > MAX_WHISPER_SIZE) {
        console.warn("Captured audio still exceeds 25MB, will send as-is");
      }

      onProgress?.({ phase: "encoding", percent: 100 });
      resolve(audioFile);
    };

    video.onended = () => {
      recorder.stop();
    };

    video.onerror = () => {
      clearInterval(progressInterval);
      URL.revokeObjectURL(blobUrl);
      audioCtx.close();
      reject(new Error("Playback error during audio extraction"));
    };

    // Start recording and playback
    recorder.start(1000);
    video.play().catch((err) => {
      clearInterval(progressInterval);
      URL.revokeObjectURL(blobUrl);
      audioCtx.close();
      reject(new Error(`Cannot play video for audio extraction: ${err.message}`));
    });

    // Progress updates
    progressInterval = setInterval(() => {
      if (duration > 0) {
        const pct = Math.min(85, 25 + (video.currentTime / duration) * 60);
        onProgress?.({ phase: "resampling", percent: Math.round(pct) });
      }
    }, 500);
  });
}

/**
 * Extract audio from a video/audio file → WAV or audio File for Whisper.
 * Works with any format the browser can decode (MP4, MOV, WebM, AVI, etc.)
 */
export async function extractAudioFromFile(
  file: File,
  onProgress?: (p: ExtractionProgress) => void
): Promise<File> {
  onProgress?.({ phase: "reading", percent: 10 });
  const arrayBuffer = await file.arrayBuffer();

  // ── Attempt 1: Fast path via decodeAudioData ──
  onProgress?.({ phase: "decoding", percent: 30 });
  const audioCtx = new AudioContext();
  let audioBuffer: AudioBuffer | null = null;

  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.warn("decodeAudioData failed:", e, "— trying fallback methods");
  }
  await audioCtx.close();

  if (audioBuffer) {
    // Success — resample to 16kHz mono WAV
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

  // ── Attempt 2: Video element + MediaRecorder fallback ──
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  console.log(`Trying video element fallback for .${ext} file (${(file.size / 1024 / 1024).toFixed(1)}MB)`);

  try {
    const result = await extractViaVideoElement(file, onProgress);
    return result;
  } catch (videoErr) {
    console.warn("Video element fallback failed:", videoErr);
  }

  // ── Attempt 3: If file is small enough, send directly to Whisper ──
  if (file.size <= MAX_WHISPER_SIZE) {
    console.log("All extraction methods failed, but file is ≤ 25MB — sending directly to Whisper");
    onProgress?.({ phase: "encoding", percent: 100 });
    return file;
  }

  // ── All attempts failed ──
  throw new Error(
    `Could not extract audio from this ${ext.toUpperCase()} file (${(file.size / 1024 / 1024).toFixed(0)}MB). ` +
    "This usually happens with iPhone .MOV files. Try one of these:\n" +
    "• Record in MP4 format (Settings → Camera → Formats → Most Compatible)\n" +
    "• Use a shorter clip (under 25MB)\n" +
    "• Convert to MP4 using a free converter before uploading"
  );
}

/** Check if a file needs audio extraction (video files or oversized audio) */
export function needsExtraction(file: File): boolean {
  // Always extract from video files (ensures compatible format for Whisper)
  if (file.type.startsWith("video/")) return true;
  // Extract from audio files that are too large
  if (file.type.startsWith("audio/") && file.size > MAX_WHISPER_SIZE) return true;
  // Extract from files with video extensions but no MIME type
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (["mov", "avi", "mkv", "wmv", "flv", "webm", "mp4", "m4v", "3gp"].includes(ext)) return true;
  return false;
}

export { MAX_WHISPER_SIZE };
