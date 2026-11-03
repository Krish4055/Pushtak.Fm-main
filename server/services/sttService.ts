/**
 * Prisma v3.0 (STT) Service
 * 
 * Verified Official Gnani v3 STT Contract:
 * - POST https://api.vachana.ai/stt/v3
 * - Header: X-API-Key-ID: process.env.GNANI_API_KEY
 * - Multipart fields:
 *     audio_file: Binary audio (WAV, MP3, OGG, FLAC, AAC, M4A. Max 30s)
 *     model: "prisma-v3.0"
 *     language_code: "indic-auto"
 * - Response JSON has "transcript"
 */

import { GNANI_CONFIG, isGnaniConfigured, isGeminiConfigured } from '../config/gnani.js';
import { GoogleGenAI } from '@google/genai';
import { gnaniQueue } from './gnaniQueue.js';

export interface STTRequest {
  audioBuffer: Buffer;
  mimeType?: string;
  originalFilename?: string;
  language?: string;
}

export interface STTResponse {
  transcript: string;
  detectedLanguage?: string;
  confidence?: number;
  source: 'gnani-prisma-v3.0' | 'gemini-transcribe-fallback';
  error?: string;
  httpStatus?: number;
}

/**
 * Transcribe audio using Gnani Prisma v3.0 with truthful error states
 */
export async function transcribeAudio(params: STTRequest): Promise<STTResponse> {
  const {
    audioBuffer,
    mimeType = 'audio/wav',
    originalFilename = 'recording.wav',
    language = GNANI_CONFIG.stt.languageCode,
  } = params;

  // 1. Try Gnani Prisma v3.0 if configured
  if (isGnaniConfigured()) {
    try {
      console.log(`[Prisma v3.0] Transcribing ${audioBuffer.length} bytes with model "prisma-v3.0"...`);

      const formData = new FormData();
      // Ensure file has accepted extension (e.g. .wav)
      const filename = originalFilename.endsWith('.wav') ? originalFilename : 'recording.wav';
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });

      formData.append('audio_file', blob, filename);
      formData.append('model', GNANI_CONFIG.stt.model); // "prisma-v3.0"
      formData.append('language_code', language || 'indic-auto'); // "indic-auto"

      const response = await gnaniQueue.enqueue(async () => {
        return fetch(GNANI_CONFIG.stt.endpoint, {
          method: 'POST',
          headers: {
            'X-API-Key-ID': GNANI_CONFIG.apiKey,
          },
          body: formData,
          signal: AbortSignal.timeout(GNANI_CONFIG.stt.timeoutMs),
        });
      });

      if (response.ok) {
        const data = await response.json() as any;
        console.log('[Prisma v3.0] STT response:', data);
        const transcript = data.transcript || data.text || '';
        return {
          transcript,
          detectedLanguage: data.language || language,
          confidence: data.confidence || 0.95,
          source: 'gnani-prisma-v3.0',
        };
      } else {
        const errorText = await response.text();
        console.warn(`[Prisma v3.0] STT failed HTTP ${response.status}:`, errorText);
        // If Gnani fails, report truthful error or fallback
        if (!isGeminiConfigured()) {
          return {
            transcript: '',
            source: 'gnani-prisma-v3.0',
            httpStatus: response.status,
            error: `Gnani STT failed (HTTP ${response.status}: ${errorText || response.statusText})`,
          };
        }
      }
    } catch (err: any) {
      console.warn('[Prisma v3.0] Network/parsing error:', err.message);
      if (!isGeminiConfigured()) {
        return {
          transcript: '',
          source: 'gnani-prisma-v3.0',
          error: `Gnani STT error: ${err.message}`,
        };
      }
    }
  }

  // 2. Fallback to Gemini Transcribe if configured
  if (isGeminiConfigured()) {
    try {
      console.log('[Gemini Transcribe] Fallback transcribing with gemini-2.5-flash...');
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              data: audioBuffer.toString('base64'),
              mimeType: mimeType.includes('wav') ? 'audio/wav' : 'audio/webm',
            },
          },
          {
            text: 'Transcribe this voice audio accurately. If it is Hindi, English, or Hinglish, transcribe the exact spoken words into text. Output only the transcription.',
          },
        ],
      });

      const transcript = response.text?.trim() || '';
      return {
        transcript,
        detectedLanguage: language,
        confidence: 0.9,
        source: 'gemini-transcribe-fallback',
      };
    } catch (geminiErr: any) {
      console.warn('[Gemini Transcribe] Fallback error:', geminiErr.message);
    }
  }

  return {
    transcript: '',
    source: 'gnani-prisma-v3.0',
    error: 'Speech-to-text service is unavailable. Please type your question.',
  };
}
