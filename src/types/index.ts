export interface SentenceItem {
  id: string;
  text: string;
  wordCount: number;
  startWordIndex: number;
}

export interface BookSection {
  id: string;
  sectionIndex: number;
  chapterIndex: number;
  chapterTitle: string;
  title: string;
  text: string;
  wordCount: number;
  estimatedDurationSeconds: number;
  sentences: SentenceItem[];
}

export interface BookChapter {
  id: string;
  chapterIndex: number;
  title: string;
  sections: BookSection[];
  totalWords: number;
}

export interface ParsedBook {
  id: string;
  title: string;
  author: string;
  language: string;
  totalWords: number;
  totalEstimatedMinutes: number;
  targetMinutesPerSection: number;
  chapters: BookChapter[];
  sections: BookSection[];
  coverGradient: string;
  addedAt?: number;
}

export interface BookProgress {
  bookId: string;
  currentSectionId: string;
  currentSectionIndex: number;
  currentSentenceIndex: number;
  currentTimeSeconds: number;
  playbackRate: number;
  lastListenedAt: number;
  completedSectionIds: string[];
}

export interface BookNote {
  id: string;
  bookId: string;
  sectionId: string;
  sectionTitle: string;
  timestampSeconds: number;
  sentenceIndex: number;
  type: 'bookmark' | 'voice_note' | 'text_note';
  content: string;
  userNote?: string;
  createdAt: number;
}

export type ThemeMode = 'light' | 'dark' | 'sepia' | 'amoled';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface VoiceDefinition {
  id: string;
  displayName: string;
  gender: 'female' | 'male';
  languages: string[];
  description: string;
  sampleSentence: string;
  isDefault?: boolean;
}

export const DEFAULT_VOICE_ID = 'Lakshmi';
export const DEFAULT_VOICE_NAME = 'Lakshmi';

export const FALLBACK_VOICES: VoiceDefinition[] = [
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

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

export interface Flashcard {
  front: string;
  back: string;
}

export interface StudyPack {
  recap30s: string;
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
  simpleExplanationHinglish: string;
  modelUsed?: string;
}

export interface AskCitation {
  sectionId: string;
  sectionTitle: string;
  relevantExcerpt: string;
}

export interface AskMessage {
  id: string;
  sender: 'user' | 'gemini' | 'evon';
  text: string;
  citations?: AskCitation[];
  timestamp: number;
  isSpoken?: boolean;
}

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'hi-Latn', label: 'Hinglish', nativeLabel: 'Hinglish' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
];
