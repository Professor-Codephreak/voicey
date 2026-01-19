/**
 * Audio Conversion Service
 * Communicates with the Node.js audio server for format conversion
 */

const AUDIO_SERVER_URL = 'http://localhost:3001';

export interface ConversionOptions {
  format: 'wav' | 'ogg' | 'mp3';
  outputPath?: string; // Local filesystem path where to save the file
}

export interface ConversionResult {
  success: boolean;
  filename: string;
  size: number;
  format: string;
  serverPath: string;
  userPath: string | null;
}

export interface AudioFileInfo {
  format: {
    filename: string;
    format_name: string;
    duration: number;
    size: number;
    bit_rate: number;
  };
  streams: Array<{
    codec_name: string;
    codec_type: string;
    sample_rate: number;
    channels: number;
  }>;
  duration: number;
  size: number;
  bitrate: number;
}

/**
 * Check if the audio server is running
 */
export async function checkServerStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${AUDIO_SERVER_URL}/health`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('Audio server not reachable:', error);
    return false;
  }
}

/**
 * Convert an audio file to a different format
 */
export async function convertAudioFile(
  file: File | Blob,
  options: ConversionOptions,
  originalFilename?: string
): Promise<ConversionResult> {
  const formData = new FormData();

  // Create a File object if we received a Blob
  if (file instanceof Blob && !(file instanceof File)) {
    const filename = originalFilename || `audio.${options.format}`;
    file = new File([file], filename, { type: file.type });
  }

  formData.append('audio', file);
  formData.append('format', options.format);

  if (options.outputPath) {
    formData.append('outputPath', options.outputPath);
  }

  const response = await fetch(`${AUDIO_SERVER_URL}/convert`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Conversion failed');
  }

  return await response.json();
}

/**
 * Convert an AudioBuffer to a file on the local filesystem
 */
export async function convertAudioBuffer(
  audioBuffer: AudioBuffer,
  options: ConversionOptions,
  filename: string
): Promise<ConversionResult> {
  // First, convert AudioBuffer to WAV blob (as intermediate format)
  const wavBlob = audioBufferToWavBlob(audioBuffer);

  // Then send to server for conversion
  return await convertAudioFile(wavBlob, options, filename);
}

/**
 * Get detailed information about an audio file
 */
export async function getAudioFileInfo(file: File | Blob): Promise<AudioFileInfo> {
  const formData = new FormData();

  if (file instanceof Blob && !(file instanceof File)) {
    file = new File([file], 'audio', { type: file.type });
  }

  formData.append('audio', file);

  const response = await fetch(`${AUDIO_SERVER_URL}/info`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get file info');
  }

  return await response.json();
}

/**
 * Download a converted file from the server
 */
export async function downloadConvertedFile(filename: string): Promise<Blob> {
  const response = await fetch(`${AUDIO_SERVER_URL}/download/${filename}`);

  if (!response.ok) {
    throw new Error('Failed to download file');
  }

  return await response.blob();
}

/**
 * Helper function to convert AudioBuffer to WAV blob
 * (Used as intermediate format before server conversion)
 */
function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const length = buffer.length * buffer.numberOfChannels * 2;
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);
  const channels: Float32Array[] = [];
  let offset = 0;
  let pos = 0;

  // Write WAV header
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };

  // "RIFF" chunk descriptor
  setUint32(0x46464952); // "RIFF"
  setUint32(36 + length); // file length - 8
  setUint32(0x45564157); // "WAVE"

  // "fmt " sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // SubChunk1Size (16 for PCM)
  setUint16(1); // AudioFormat (1 for PCM)
  setUint16(buffer.numberOfChannels);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * buffer.numberOfChannels * 2); // byte rate
  setUint16(buffer.numberOfChannels * 2); // block align
  setUint16(16); // bits per sample

  // "data" sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(length);

  // Write interleaved data
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (pos < arrayBuffer.byteLength) {
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Recording-specific interfaces and functions
 */

export interface SaveRecordingOptions {
  directory?: string;
  filename?: string;
  format: 'wav' | 'ogg' | 'mp3';
}

export interface SaveRecordingResult {
  success: boolean;
  path: string;
  filename: string;
  size: number;
  format: string;
  directory: string;
}

export interface AudioQualityMetrics {
  sample_rate_quality: 'good' | 'low';
  bit_depth_quality: 'good' | 'compressed';
  clipping_detected: boolean;
  noise_floor: number;
  peak_level: number;
  dynamic_range: number;
  overall_quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface AudioAnalysisResult {
  codec: string;
  sample_rate: number;
  channels: number;
  bit_rate: number;
  duration: number;
  volume_stats: {
    max_volume?: number;
    mean_volume?: number;
  };
  quality_metrics: AudioQualityMetrics;
}

/**
 * Save a recording to local filesystem
 */
export async function saveRecording(
  file: File | Blob,
  options: SaveRecordingOptions,
  originalFilename?: string
): Promise<SaveRecordingResult> {
  const formData = new FormData();

  if (file instanceof Blob && !(file instanceof File)) {
    const filename = originalFilename || `recording.${options.format}`;
    file = new File([file], filename, { type: file.type });
  }

  formData.append('audio', file);
  formData.append('format', options.format);

  if (options.directory) {
    formData.append('directory', options.directory);
  }
  if (options.filename) {
    formData.append('filename', options.filename);
  }

  const response = await fetch(`${AUDIO_SERVER_URL}/save-recording`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to save recording');
  }

  return await response.json();
}

/**
 * Get default recording directory
 */
export async function getRecordingDirectory(): Promise<{ directory: string; exists: boolean }> {
  const response = await fetch(`${AUDIO_SERVER_URL}/recording-directory`);

  if (!response.ok) {
    throw new Error('Failed to get recording directory');
  }

  return await response.json();
}

/**
 * Set custom recording directory
 */
export async function setRecordingDirectory(directory: string): Promise<{ success: boolean; directory: string }> {
  const response = await fetch(`${AUDIO_SERVER_URL}/recording-directory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ directory }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to set recording directory');
  }

  return await response.json();
}

/**
 * Analyze audio quality metrics
 */
export async function analyzeAudioQuality(file: File | Blob): Promise<AudioAnalysisResult> {
  const formData = new FormData();

  if (file instanceof Blob && !(file instanceof File)) {
    file = new File([file], 'audio', { type: file.type });
  }

  formData.append('audio', file);

  const response = await fetch(`${AUDIO_SERVER_URL}/analyze-audio`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to analyze audio');
  }

  return await response.json();
}
