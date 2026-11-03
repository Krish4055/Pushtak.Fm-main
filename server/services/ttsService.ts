/**
 * Timbre v3.0 (TTS) Service
 * 
 * Verified Official Gnani v3 Contract:
 * - Endpoint: POST https://api.vachana.ai/api/v1/tts/inference
 * - Auth Header: X-API-Key-ID: process.env.GNANI_API_KEY
 * - Model: timbre-v3.0
 * - Voices: Lakshmi (default), Vasudha, Shivani, Yashraj, Prakash, Avinash
 * - Audio Config: 24000 Hz, 1 channel, 16-bit linear PCM WAV
 * - 700 character chunking limit with sentence boundary splitting
 * - Angle-bracket text cleaning (<laugh>, <pauses> tag removal)
 * - Truthful error reporting with HTTP status and reason
 */

import { GNANI_CONFIG, isGnaniConfigured } from '../config/gnani.js';
import { DEFAULT_VOICE_ID } from '../config/voices.config.js';
import { gnaniQueue, voicePreviewCache } from './gnaniQueue.js';

export interface TTSRequest {
  text: string;
  language?: string;
  voice?: string;
  speed?: number; // 0.75 - 2.0
  sectionId?: string;
}

export interface TTSResponse {
  audioBuffer?: Buffer;
  audioContentType: string;
  source: 'gnani-timbre-v3.0' | 'browser-speech-fallback';
  durationEstimateSeconds: number;
  message?: string;
  gnaniFailed?: boolean;
  gnaniStatus?: number;
  gnaniReason?: string;
}

/**
 * Text Cleaning:
 * Timbre v3.0 interprets tags like <laugh> and <pauses>.
 * Before sending book text, strip text in angle brackets so book content is never treated as an audio tag.
 */
export function cleanTextForTTS(rawText: string): string {
  if (!rawText) return '';
  return rawText
    // Remove angle bracket tags like <laugh>, <pauses>, <...>, or HTML tags
    .replace(/<[^>]*>/g, ' ')
    // Normalize excessive whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split long text into chunks of <= 700 characters at sentence / punctuation boundaries.
 */
export function chunkTextForTTS(text: string, maxChars: number = 700): string[] {
  const cleaned = cleanTextForTTS(text);
  if (!cleaned) return [];
  if (cleaned.length <= maxChars) return [cleaned];

  const chunks: string[] = [];
  // Split on sentence boundaries: period, exclamation, question mark, devanagari danda, newline
  const sentenceRegex = /[^.!?।\n]+[.!?।\n]+|[^.!?।\n]+$/g;
  const sentences = cleaned.match(sentenceRegex) || [cleaned];

  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    // If single sentence itself exceeds maxChars, split by comma or spaces
    if (trimmedSentence.length > maxChars) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      const subParts = trimmedSentence.match(new RegExp(`.{1,${maxChars}}(?:\\s|$)|.{1,${maxChars}}`, 'g')) || [trimmedSentence];
      for (const part of subParts) {
        if (part.trim()) chunks.push(part.trim());
      }
      continue;
    }

    if ((currentChunk + ' ' + trimmedSentence).trim().length <= maxChars) {
      currentChunk = currentChunk ? `${currentChunk} ${trimmedSentence}` : trimmedSentence;
    } else {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmedSentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

/**
 * Stitch multiple PCM WAV buffers (24000Hz, 1 channel, 16-bit linear PCM) into a single valid WAV buffer.
 */
export function stitchWavBuffers(wavBuffers: Buffer[]): Buffer {
  if (wavBuffers.length === 0) return Buffer.alloc(0);
  if (wavBuffers.length === 1) return wavBuffers[0];

  const pcmChunks: Buffer[] = [];
  let totalPcmBytes = 0;

  for (const buf of wavBuffers) {
    let dataOffset = 44;
    const dataIndex = buf.indexOf(Buffer.from('data'));
    if (dataIndex !== -1 && dataIndex + 8 <= buf.length) {
      dataOffset = dataIndex + 8;
    }
    const pcm = buf.subarray(dataOffset);
    pcmChunks.push(pcm);
    totalPcmBytes += pcm.length;
  }

  // Construct standard 44-byte WAV header
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + totalPcmBytes, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);             // Subchunk1Size (16 for PCM)
  header.writeUInt16LE(1, 20);              // AudioFormat (1 = PCM)
  header.writeUInt16LE(1, 22);              // NumChannels (1 = Mono)
  header.writeUInt32LE(24000, 24);          // SampleRate (24000)
  header.writeUInt32LE(24000 * 1 * 2, 28);  // ByteRate = SampleRate * NumChannels * BitsPerSample/8
  header.writeUInt16LE(2, 32);              // BlockAlign = NumChannels * BitsPerSample/8
  header.writeUInt16LE(16, 34);             // BitsPerSample (16 bits)
  header.write('data', 36);
  header.writeUInt32LE(totalPcmBytes, 40);

  return Buffer.concat([header, ...pcmChunks]);
}

/**
 * Synthesizes a single chunk with Gnani Timbre v3.0, routed through global GnaniQueue
 * to strictly prevent concurrent requests and HTTP 429 rate limits.
 */
async function callTimbreV3SingleChunk(
  params: {
    text: string;
    voice: string;
    language: string;
    speed: number;
  },
  retriesLeft: number = 3
): Promise<{ ok: boolean; status: number; buffer?: Buffer; error?: string }> {
  const { text, voice, language, speed } = params;

  // Static preview cache for sample sentences to avoid calling API
  const isShortSample = text.length < 160;
  const sampleCacheKey = `${voice}_${language}_${speed}_${text}`;
  if (isShortSample && voicePreviewCache.has(sampleCacheKey)) {
    return { ok: true, status: 200, buffer: voicePreviewCache.get(sampleCacheKey) };
  }

  const payload = {
    text,
    voice,
    model: GNANI_CONFIG.tts.model, // timbre-v3.0
    language: language || GNANI_CONFIG.tts.defaultLanguage,
    speed: speed || 1.0,
    audio_config: GNANI_CONFIG.tts.audioConfig,
  };

  return gnaniQueue.enqueue(async () => {
    try {
      const response = await fetch(GNANI_CONFIG.tts.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key-ID': GNANI_CONFIG.apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(GNANI_CONFIG.tts.timeoutMs),
      });

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        const buf = Buffer.from(arrayBuffer);
        if (isShortSample) {
          voicePreviewCache.set(sampleCacheKey, buf);
        }
        return { ok: true, status: response.status, buffer: buf };
      }

      // Auto backoff retry on 429 (Gnani enforces 1 active request per key limit)
      if (response.status === 429 && retriesLeft > 0) {
        console.warn(`[Timbre v3.0] Rate-limited (429: 1 active request rule). Backing off 1000ms before retry (${retriesLeft} retries left)...`);
        await new Promise((res) => setTimeout(res, 1000));
        return callTimbreV3SingleChunk(params, retriesLeft - 1);
      }

      const errText = await response.text();
      return { ok: false, status: response.status, error: errText || response.statusText };
    } catch (err: any) {
      return { ok: false, status: 0, error: err.message || 'Network request failed' };
    }
  });
}

/**
 * Main synthesis function:
 * Splits text into <= 700 character chunks, synthesizes each, stitches the WAV audio, and returns truthful errors.
 */
export async function synthesizeSectionSpeech(params: TTSRequest): Promise<TTSResponse> {
  const {
    text,
    language = 'auto',
    voice = DEFAULT_VOICE_ID,
    speed = 1.0,
  } = params;

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const durationEstimateSeconds = Math.max(1, Math.round((wordCount / (140 * speed)) * 60));

  // If Gnani API key is not configured, inform honestly
  if (!isGnaniConfigured()) {
    return {
      audioContentType: 'application/json',
      source: 'browser-speech-fallback',
      message: 'Gnani API key is not configured. Using device voice.',
      durationEstimateSeconds,
    };
  }

  // 1. Text cleaning & Chunking (700 chars max)
  const chunks = chunkTextForTTS(text, GNANI_CONFIG.tts.charLimitPerRequest);
  if (chunks.length === 0) {
    return {
      audioContentType: 'application/json',
      source: 'browser-speech-fallback',
      message: 'No readable text content provided.',
      durationEstimateSeconds: 0,
    };
  }

  console.log(`[Timbre v3.0] Synthesizing ${chunks.length} chunk(s) with voice "${voice}"...`);

  const wavBuffers: Buffer[] = [];
  let lastFailStatus = 0;
  let lastFailReason = '';

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    let chunkResult = await callTimbreV3SingleChunk({
      text: chunk,
      voice,
      language,
      speed,
    });

    // If initial attempt fails and voice was not default, try with default voice 'Lakshmi'
    if (!chunkResult.ok && voice !== DEFAULT_VOICE_ID) {
      console.warn(`[Timbre v3.0] Voice "${voice}" failed on chunk ${i + 1}. Retrying with default voice "${DEFAULT_VOICE_ID}"...`);
      chunkResult = await callTimbreV3SingleChunk({
        text: chunk,
        voice: DEFAULT_VOICE_ID,
        language,
        speed,
      });
    }

    if (chunkResult.ok && chunkResult.buffer) {
      wavBuffers.push(chunkResult.buffer);
    } else {
      lastFailStatus = chunkResult.status;
      lastFailReason = chunkResult.error || 'Speech synthesis failed';
      console.warn(`[Timbre v3.0] Chunk ${i + 1}/${chunks.length} failed: HTTP ${lastFailStatus} - ${lastFailReason}`);
      break;
    }
  }

  // If all chunks succeeded, stitch and return WAV
  if (wavBuffers.length === chunks.length) {
    const stitched = stitchWavBuffers(wavBuffers);
    return {
      audioBuffer: stitched,
      audioContentType: 'audio/wav',
      source: 'gnani-timbre-v3.0',
      durationEstimateSeconds,
    };
  }

  // Truthful error reporting
  const errorMessage = `Gnani voice failed (HTTP ${lastFailStatus || 'Network'}: ${lastFailReason}), using device voice.`;
  console.warn(`[Timbre v3.0] Truthful error fallback: ${errorMessage}`);

  return {
    audioContentType: 'application/json',
    source: 'browser-speech-fallback',
    message: errorMessage,
    gnaniFailed: true,
    gnaniStatus: lastFailStatus,
    gnaniReason: lastFailReason,
    durationEstimateSeconds,
  };
}
