/**
 * Gnani AI Configuration
 * 
 * Verified Official Gnani v3 Endpoints & Contracts:
 * - Timbre v3.0 (TTS): https://api.vachana.ai/api/v1/tts/inference
 * - Prisma v3.0 (STT): https://api.vachana.ai/stt/v3
 * - Auth Header: X-API-Key-ID: process.env.GNANI_API_KEY (Server-side only)
 * - LLM: Gemini 3.8 Flash for Q&A, summarization, and study packs
 */

export interface GnaniConfig {
  apiKey: string;
  tts: {
    endpoint: string;
    model: string;
    defaultVoice: string;
    defaultLanguage: string;
    sampleRate: number;
    audioConfig: {
      sample_rate: number;
      num_channels: number;
      sample_width: number;
      encoding: 'linear_pcm';
      container: 'wav';
    };
    charLimitPerRequest: number; // 700 chars safe limit
    timeoutMs: number;
    maxRetries: number;
  };
  stt: {
    endpoint: string;
    model: string;
    languageCode: string;
    maxDurationSeconds: number; // 30 seconds max
    supportedFormats: string[];
    timeoutMs: number;
  };
}

export const GNANI_CONFIG: GnaniConfig = {
  apiKey: process.env.GNANI_API_KEY || '',

  tts: {
    endpoint: process.env.GNANI_TTS_ENDPOINT || 'https://api.vachana.ai/api/v1/tts/inference',
    model: 'timbre-v3.0',
    defaultVoice: 'Lakshmi',
    defaultLanguage: 'auto',
    sampleRate: 24000,
    audioConfig: {
      sample_rate: 24000,
      num_channels: 1,
      sample_width: 2,
      encoding: 'linear_pcm',
      container: 'wav',
    },
    charLimitPerRequest: 700,
    timeoutMs: 15000,
    maxRetries: 2,
  },

  stt: {
    endpoint: process.env.GNANI_STT_ENDPOINT || 'https://api.vachana.ai/stt/v3',
    model: 'prisma-v3.0',
    languageCode: 'indic-auto',
    maxDurationSeconds: 30,
    supportedFormats: ['wav', 'mp3', 'ogg', 'flac', 'aac', 'm4a'],
    timeoutMs: 15000,
  },
};

/**
 * Checks whether Gnani API key is configured
 */
export function isGnaniConfigured(): boolean {
  return Boolean(process.env.GNANI_API_KEY && process.env.GNANI_API_KEY.trim() !== '');
}

/**
 * Checks whether Gemini key is configured for LLM Q&A
 */
export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
}
