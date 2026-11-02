/**
 * Voice Service for Gnani Timbre v3.0
 * 
 * Returns verified official voice catalog (Lakshmi, Vasudha, Shivani, Yashraj, Prakash, Avinash)
 */

import { GNANI_VOICES, DEFAULT_VOICE_ID, VoiceDefinition } from '../config/voices.config.js';

export async function getAvailableVoices(): Promise<{
  voices: VoiceDefinition[];
  defaultVoiceId: string;
  source: 'config';
}> {
  return {
    voices: GNANI_VOICES,
    defaultVoiceId: DEFAULT_VOICE_ID,
    source: 'config',
  };
}

export function getDefaultVoiceId(): string {
  return DEFAULT_VOICE_ID;
}
