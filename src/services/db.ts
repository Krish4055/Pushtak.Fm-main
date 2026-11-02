/**
 * IndexedDB Client Storage for Pushtak.fm
 * 
 * Manages:
 * - Books library (persisting uploaded & demo books)
 * - Exact listening progress per book (section, sentence, timestamps)
 * - Audio blob cache: keyed by hash(text + voice + language + speed) to save limited API credits
 * - Student Mode study packs, bookmarks, voice notes, and spaced repetition flashcards
 * - User preferences (theme, font, listening interval, offline downloads)
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { ParsedBook, BookProgress, StudyPack } from '../types';

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

export interface SpacedReviewCard {
  id: string;
  bookId: string;
  sectionId: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  nextReviewDate: number; // timestamp
  reviewCount: number;
}

interface PushtakDB extends DBSchema {
  books: {
    key: string;
    value: ParsedBook;
  };
  progress: {
    key: string; // bookId
    value: BookProgress;
  };
  audioCache: {
    key: string; // hash(text + voice + language + speed)
    value: {
      cacheKey: string;
      sectionId: string;
      blob: Blob;
      mimeType: string;
      cachedAt: number;
      durationEstimateSeconds: number;
      speed: number;
      voice: string;
      language: string;
    };
    indexes: { 'by-section': string };
  };
  studyPacks: {
    key: string; // sectionId
    value: {
      sectionId: string;
      bookId: string;
      pack: StudyPack;
      savedAt: number;
    };
  };
  notes: {
    key: string;
    value: BookNote;
    indexes: { 'by-book': string };
  };
  spacedCards: {
    key: string;
    value: SpacedReviewCard;
    indexes: { 'by-book': string; 'by-next-review': number };
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'pushtak_fm_db_v2';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<PushtakDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PushtakDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PushtakDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'bookId' });
        }
        if (!db.objectStoreNames.contains('audioCache')) {
          const audioStore = db.createObjectStore('audioCache', { keyPath: 'cacheKey' });
          audioStore.createIndex('by-section', 'sectionId');
        }
        if (!db.objectStoreNames.contains('studyPacks')) {
          db.createObjectStore('studyPacks', { keyPath: 'sectionId' });
        }
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('by-book', 'bookId');
        }
        if (!db.objectStoreNames.contains('spacedCards')) {
          const cardsStore = db.createObjectStore('spacedCards', { keyPath: 'id' });
          cardsStore.createIndex('by-book', 'bookId');
          cardsStore.createIndex('by-next-review', 'nextReviewDate');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Generate SHA-256 hash string for audio caching
 * Keyed by: hash(text + voice + language + speed)
 */
export async function computeAudioCacheKey(
  text: string,
  voice: string,
  language: string,
  speed: number
): Promise<string> {
  const normalizedSpeed = Math.round(speed * 100) / 100;
  const input = `${text.trim()}|${voice}|${language}|${normalizedSpeed}`;

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback simple hash
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash-${Math.abs(hash)}`;
}

// --- BOOK OPERATIONS ---

export async function saveBook(book: ParsedBook): Promise<void> {
  const db = await getDB();
  await db.put('books', {
    ...book,
    addedAt: book.addedAt || Date.now(),
  });
}

export async function getBook(id: string): Promise<ParsedBook | undefined> {
  const db = await getDB();
  return db.get('books', id);
}

export async function getAllBooks(): Promise<ParsedBook[]> {
  const db = await getDB();
  return db.getAll('books');
}

export async function deleteBook(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('books', id);
  await db.delete('progress', id);
}

// --- PROGRESS OPERATIONS ---

export async function saveProgress(progress: BookProgress): Promise<void> {
  const db = await getDB();
  await db.put('progress', progress);
}

export async function getProgress(bookId: string): Promise<BookProgress | undefined> {
  const db = await getDB();
  return db.get('progress', bookId);
}

export async function getAllProgress(): Promise<BookProgress[]> {
  const db = await getDB();
  return db.getAll('progress');
}

// --- AUDIO CACHE OPERATIONS ---

export async function saveCachedAudio(params: {
  cacheKey: string;
  sectionId: string;
  blob: Blob;
  mimeType: string;
  durationEstimateSeconds: number;
  speed: number;
  voice: string;
  language: string;
}): Promise<void> {
  try {
    const db = await getDB();
    await db.put('audioCache', {
      cacheKey: params.cacheKey,
      sectionId: params.sectionId,
      blob: params.blob,
      mimeType: params.mimeType,
      cachedAt: Date.now(),
      durationEstimateSeconds: params.durationEstimateSeconds,
      speed: params.speed,
      voice: params.voice,
      language: params.language,
    });
    console.log(`[Audio Cache] Cached key: ${params.cacheKey.slice(0, 12)} for section ${params.sectionId} (${(params.blob.size / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.warn('[Audio Cache] Failed to write cache:', err);
  }
}

export async function getCachedAudioByKey(
  cacheKey: string
): Promise<{ blob: Blob; mimeType: string; durationEstimateSeconds: number } | undefined> {
  try {
    const db = await getDB();
    const entry = await db.get('audioCache', cacheKey);
    if (entry) {
      return {
        blob: entry.blob,
        mimeType: entry.mimeType,
        durationEstimateSeconds: entry.durationEstimateSeconds,
      };
    }
  } catch (err) {
    console.warn('[Audio Cache] Read error:', err);
  }
  return undefined;
}

export async function isSectionAudioCached(sectionId: string): Promise<boolean> {
  try {
    const db = await getDB();
    const entries = await db.getAllFromIndex('audioCache', 'by-section', sectionId);
    return entries.length > 0;
  } catch {
    return false;
  }
}

// --- STUDY PACK OPERATIONS ---

export async function saveStudyPack(sectionId: string, bookId: string, pack: StudyPack): Promise<void> {
  const db = await getDB();
  await db.put('studyPacks', {
    sectionId,
    bookId,
    pack,
    savedAt: Date.now(),
  });
}

export async function getStudyPack(sectionId: string): Promise<StudyPack | undefined> {
  const db = await getDB();
  const entry = await db.get('studyPacks', sectionId);
  return entry?.pack;
}

// --- NOTES & BOOKMARKS ---

export async function saveNote(note: BookNote): Promise<void> {
  const db = await getDB();
  await db.put('notes', note);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('pushtak:notes-updated', { detail: { bookId: note.bookId } }));
  }
}

export async function getNotesForBook(bookId: string): Promise<BookNote[]> {
  const db = await getDB();
  return db.getAllFromIndex('notes', 'by-book', bookId);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  const note = await db.get('notes', id);
  await db.delete('notes', id);
  if (typeof window !== 'undefined' && note) {
    window.dispatchEvent(new CustomEvent('pushtak:notes-updated', { detail: { bookId: note.bookId } }));
  }
}

// --- SPACED REPETITION FLASHCARDS ---

export async function saveSpacedCard(card: SpacedReviewCard): Promise<void> {
  const db = await getDB();
  await db.put('spacedCards', card);
}

export async function getCardsDueForReview(): Promise<SpacedReviewCard[]> {
  const db = await getDB();
  const now = Date.now();
  const allCards = await db.getAll('spacedCards');
  return allCards.filter((c) => c.nextReviewDate <= now);
}

export async function getAllSpacedCards(): Promise<SpacedReviewCard[]> {
  const db = await getDB();
  return db.getAll('spacedCards');
}

// --- SETTINGS & PRIVACY ---

export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const val = await db.get('settings', key);
  return val !== undefined ? val : defaultValue;
}

export async function setSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('settings', value, key);
}

/**
 * Privacy Action: "Delete my data" completely purges IndexedDB
 */
export async function clearAllUserData(): Promise<void> {
  const db = await getDB();
  await db.clear('books');
  await db.clear('progress');
  await db.clear('audioCache');
  await db.clear('studyPacks');
  await db.clear('notes');
  await db.clear('spacedCards');
  await db.clear('settings');
  console.log('[Pushtak.fm] All user data successfully wiped from IndexedDB.');
}
