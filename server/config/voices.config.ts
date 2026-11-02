/**
 * Gnani Timbre v3.0 Voice Configurations
 * 
 * Verified Official Voice IDs for timbre-v3.0:
 * The voice ID is the exact name. All voices speak all 10 supported Indian languages:
 * [en-IN, hi-IN, ta-IN, te-IN, kn-IN, ml-IN, mr-IN, pa-IN, bn-IN, gu-IN].
 * 
 * Model: timbre-v3.0
 */

export interface VoiceDefinition {
  id: string;
  displayName: string;
  gender: 'female' | 'male';
  languages: string[];
  description: string;
  sampleSentence: string;
  isDefault?: boolean;
}

export const GNANI_VOICES: VoiceDefinition[] = [
  {
    id: 'Lakshmi',
    displayName: 'Lakshmi',
    gender: 'female',
    languages: ['auto', 'en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'bn-IN', 'gu-IN'],
    description: 'Expressive and warm voice. Ideal for storytelling, audiobooks and e-learning.',
    sampleSentence: 'Welcome to Pushtak. I will read your books and study guides in a warm, expressive voice.',
    isDefault: true,
  },
  {
    id: 'Vasudha',
    displayName: 'Vasudha',
    gender: 'female',
    languages: ['auto', 'en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'bn-IN', 'gu-IN'],
    description: 'Expressive and composed tone. Perfect for long chapters and educational lectures.',
    sampleSentence: 'Consistent daily focus creates mastery. Let us begin reading through this chapter.',
  },
  {
    id: 'Shivani',
    displayName: 'Shivani',
    gender: 'female',
    languages: ['auto', 'en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'bn-IN', 'gu-IN'],
    description: 'Warm and patient cadence. Well suited for tutorials, revision and deep focus.',
    sampleSentence: 'Here is the key insight from this section. Notice how each concept connects to the next.',
  },
  {
    id: 'Yashraj',
    displayName: 'Yashraj',
    gender: 'male',
    languages: ['auto', 'en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'bn-IN', 'gu-IN'],
    description: 'Warm, engaging narrative voice. Great for biographies, history and philosophy.',
    sampleSentence: 'Every journey begins with quiet observation. Settle in as we explore this section together.',
  },
  {
    id: 'Prakash',
    displayName: 'Prakash',
    gender: 'male',
    languages: ['auto', 'en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'bn-IN', 'gu-IN'],
    description: 'Steady, deliberate and clear. Excellent for academic texts and technical guides.',
    sampleSentence: 'Careful examination reveals clarity in complex ideas. We will examine each point deliberately.',
  },
  {
    id: 'Avinash',
    displayName: 'Avinash',
    gender: 'male',
    languages: ['auto', 'en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'bn-IN', 'gu-IN'],
    description: 'Professional and firm delivery. Great for business books, news and summaries.',
    sampleSentence: 'Clear decision-making begins with verified facts and disciplined execution.',
  },
];

export const DEFAULT_VOICE_ID = 'Lakshmi';
export const DEFAULT_VOICE_NAME = 'Lakshmi';
