/**
 * Book Parser & Smart Section Splitter
 * 
 * Supports:
 * - PDF (pdf-parse)
 * - DOCX (mammoth)
 * - TXT & Markdown
 * - Pasted raw text
 * 
 * Features:
 * - Detects chapters/headings
 * - Splits into sections by listening time (5 min, 10 min, 20 min)
 * - NEVER cuts mid-sentence (boundary-aware sentence tokenizer)
 * - Computes sentence array for synchronized karaoke highlighting
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
import mammoth from 'mammoth';

/**
 * Universal PDF parser that handles both pdf-parse v2 (PDFParse class) and v1 (function)
 */
async function parsePdfBuffer(buffer: Buffer): Promise<{ text: string; title?: string }> {
  const pdfModule: any = require('pdf-parse');

  // Handle pdf-parse v2.x (class PDFParse)
  if (pdfModule && typeof pdfModule.PDFParse === 'function') {
    const parser = new pdfModule.PDFParse({ data: buffer });
    try {
      const textResult = await parser.getText();
      let docTitle: string | undefined;
      try {
        const infoResult = await parser.getInfo();
        docTitle = infoResult?.info?.Title || infoResult?.Title;
      } catch {
        // ignore info fetch warning
      }
      return {
        text: textResult?.text || '',
        title: docTitle,
      };
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy().catch(() => {});
      }
    }
  }

  // Handle pdf-parse v1.x (direct function)
  if (typeof pdfModule === 'function') {
    const data = await pdfModule(buffer);
    return {
      text: data.text || '',
      title: data.info?.Title,
    };
  }

  // Handle default export if present
  if (pdfModule && typeof pdfModule.default === 'function') {
    const data = await pdfModule.default(buffer);
    return {
      text: data.text || '',
      title: data.info?.Title,
    };
  }

  throw new Error('Unsupported pdf-parse export structure.');
}

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
  estimatedDurationSeconds: number; // e.g. 300s (5m), 600s (10m), 1200s (20m)
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
}

// Beautiful calming gradient presets for book covers
const COVER_GRADIENTS = [
  'from-slate-900 via-indigo-950 to-blue-900',
  'from-amber-950 via-stone-900 to-amber-900',
  'from-emerald-950 via-teal-950 to-slate-900',
  'from-rose-950 via-purple-950 to-indigo-950',
  'from-cyan-950 via-blue-950 to-indigo-950',
  'from-zinc-900 via-neutral-900 to-stone-900',
];

export interface TokenizedSentence {
  text: string;
  wordCount: number;
}

/**
 * Fast, deterministic O(N) sentence tokenizer that avoids regex backtracking on large documents.
 * Computes word counts in the same pass to eliminate redundant .split(/\s+/) calls.
 */
export function splitIntoSentencesWithCounts(text: string): TokenizedSentence[] {
  if (!text) return [];

  const sentences: TokenizedSentence[] = [];
  const len = text.length;
  let start = 0;
  let inWhitespace = true;
  let wordCount = 0;

  for (let i = 0; i < len; i++) {
    const ch = text.charCodeAt(i);
    const isWs = ch === 32 || ch === 9 || ch === 10 || ch === 13; // space, tab, newline, cr

    if (isWs) {
      inWhitespace = true;
    } else {
      if (inWhitespace) {
        wordCount++;
        inWhitespace = false;
      }
    }

    // Check sentence terminators: . (46), ! (33), ? (63), । (Devanagari danda), or double newline (\n\n)
    const isTerminator = ch === 46 || ch === 33 || ch === 63 || text[i] === '।';
    const isDoubleNewline = ch === 10 && i + 1 < len && text.charCodeAt(i + 1) === 10;

    if (isTerminator || isDoubleNewline) {
      // Decimal lookahead: e.g. 3.14
      if (ch === 46 && i + 1 < len && text.charCodeAt(i + 1) >= 48 && text.charCodeAt(i + 1) <= 57) {
        continue;
      }
      // Common abbreviation lookahead: Mr. Dr. etc.
      if (ch === 46) {
        const prevWordStart = text.lastIndexOf(' ', i - 1);
        const prefix = text.substring(prevWordStart === -1 ? start : prevWordStart + 1, i).toLowerCase();
        if (
          prefix === 'mr' ||
          prefix === 'mrs' ||
          prefix === 'ms' ||
          prefix === 'dr' ||
          prefix === 'prof' ||
          prefix === 'vs' ||
          prefix === 'etc' ||
          prefix === 'eg' ||
          prefix === 'ie'
        ) {
          continue;
        }
      }

      const end = isDoubleNewline ? i : i + 1;
      const sentenceText = text.substring(start, end).trim();
      if (sentenceText.length > 0 && wordCount > 0) {
        sentences.push({ text: sentenceText, wordCount });
      }
      start = isDoubleNewline ? i + 2 : i + 1;
      wordCount = 0;
      inWhitespace = true;
    }
  }

  // Trailing sentence
  if (start < len) {
    const sentenceText = text.substring(start).trim();
    if (sentenceText.length > 0) {
      const remainingWords = sentenceText.split(/\s+/).filter(Boolean).length;
      if (remainingWords > 0) {
        sentences.push({ text: sentenceText, wordCount: remainingWords });
      }
    }
  }

  return sentences.length > 0 ? sentences : [{ text: text.trim(), wordCount: Math.max(1, wordCount) }];
}

/**
 * Split a block of text into distinct sentences without breaking initials or abbreviations
 */
export function splitIntoSentences(text: string): string[] {
  return splitIntoSentencesWithCounts(text).map((s) => s.text);
}

/**
 * Detect language of text (Hindi, English, Bengali, Tamil, etc.)
 */
export function detectLanguage(text: string): string {
  const sample = text.slice(0, 2000);
  // Devanagari range
  if (/[\u0900-\u097F]/.test(sample)) return 'hi';
  // Bengali
  if (/[\u0980-\u09FF]/.test(sample)) return 'bn';
  // Tamil
  if (/[\u0B80-\u0BFF]/.test(sample)) return 'ta';
  // Telugu
  if (/[\u0C00-\u0C7F]/.test(sample)) return 'te';
  // Kannada
  if (/[\u0C80-\u0CFF]/.test(sample)) return 'kn';
  return 'en';
}

/**
 * Extract raw text from file buffer
 */
export async function extractTextFromFile(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<{ title: string; text: string }> {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const baseName = filename.replace(/\.[^/.]+$/, '');

  if (ext === 'pdf' || mimeType === 'application/pdf') {
    const pdfData = await parsePdfBuffer(buffer);
    return {
      title: pdfData.title || baseName,
      text: pdfData.text || '',
    };
  }

  if (ext === 'docx' || mimeType?.includes('wordprocessingml')) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      title: baseName,
      text: result.value || '',
    };
  }

  // Plain text / Markdown / generic text
  const text = buffer.toString('utf-8');
  return {
    title: baseName,
    text,
  };
}

/**
 * Split raw book text into chapters and listening-time-based sections
 * targetMinutes: 5, 10, or 20 minutes (default 10)
 * standard speaking rate: 140 words per minute
 */
export function processBookText(
  title: string,
  rawText: string,
  targetMinutes: number = 10,
  author: string = 'Unknown Author'
): ParsedBook {
  const bookId = 'book-' + Math.random().toString(36).substring(2, 9);
  const wordsPerMinute = 140;
  const targetWordsPerSection = targetMinutes * wordsPerMinute; // e.g. 700, 1400, 2800

  const language = detectLanguage(rawText);
  const gradient = COVER_GRADIENTS[Math.floor(Math.random() * COVER_GRADIENTS.length)];

  // Detect potential chapter markers:
  // e.g. "Chapter 1", "CHAPTER I", "Part 2", "Section 3", "# Title", "Act I"
  const chapterRegex = /(?:\n{2,}|\A)(?:(?:Chapter|CHAPTER|Part|PART|Section|SECTION|Act|ACT)\s+(?:[0-9IVXLCDM]+|[A-Za-z]+)(?::[^\n]*|\n)|#+\s+[^\n]+)/g;

  let rawChapters: { title: string; content: string }[] = [];
  const matches = Array.from(rawText.matchAll(chapterRegex));

  if (matches.length >= 2) {
    let lastIndex = 0;
    let lastTitle = 'Introduction';

    for (const match of matches) {
      const matchIndex = match.index ?? 0;
      if (matchIndex > lastIndex) {
        const chunk = rawText.slice(lastIndex, matchIndex).trim();
        if (chunk.length > 100) {
          rawChapters.push({ title: lastTitle, content: chunk });
        }
      }
      lastTitle = match[0].replace(/^#+\s*/, '').trim();
      lastIndex = matchIndex + match[0].length;
    }

    const finalChunk = rawText.slice(lastIndex).trim();
    if (finalChunk.length > 50) {
      rawChapters.push({ title: lastTitle, content: finalChunk });
    }
  } else {
    // If no explicit chapters found, treat the whole text or major section breaks as chapters
    const paragraphs = rawText.split(/\n{3,}/).filter((p) => p.trim().length > 0);
    if (paragraphs.length > 1) {
      rawChapters = paragraphs.map((p, idx) => ({
        title: `Chapter ${idx + 1}`,
        content: p,
      }));
    } else {
      rawChapters = [{ title: 'Chapter 1', content: rawText }];
    }
  }

  // Now, for each chapter, break into smart listening sections that NEVER cut mid-sentence!
  const chapters: BookChapter[] = [];
  const allSections: BookSection[] = [];
  let globalSectionIndex = 0;
  let totalBookWords = 0;

  rawChapters.forEach((rawChap, chapIdx) => {
    const chapterSentences = splitIntoSentencesWithCounts(rawChap.content);
    const chapterSections: BookSection[] = [];
    let currentSectionSentences: TokenizedSentence[] = [];
    let currentSectionWords = 0;
    let subSectionNum = 1;

    const flushSection = () => {
      if (currentSectionSentences.length === 0) return;

      const sectionText = currentSectionSentences.map((s) => s.text).join(' ');
      const sectionWordCount = currentSectionWords;
      totalBookWords += sectionWordCount;

      const durationSec = Math.max(1, Math.round((sectionWordCount / wordsPerMinute) * 60));

      // Build sentence items with word indices
      let wordCursor = 0;
      const sentenceItems: SentenceItem[] = currentSectionSentences.map((sent, sIdx) => {
        const item: SentenceItem = {
          id: `sec-${globalSectionIndex}-sent-${sIdx}`,
          text: sent.text,
          wordCount: sent.wordCount,
          startWordIndex: wordCursor,
        };
        wordCursor += sent.wordCount;
        return item;
      });

      const sectionTitle =
        subSectionNum === 1 && currentSectionSentences.length === chapterSentences.length
          ? rawChap.title
          : `${rawChap.title} — Part ${subSectionNum}`;

      const section: BookSection = {
        id: `sec-${globalSectionIndex}`,
        sectionIndex: globalSectionIndex,
        chapterIndex: chapIdx,
        chapterTitle: rawChap.title,
        title: sectionTitle,
        text: sectionText,
        wordCount: sectionWordCount,
        estimatedDurationSeconds: durationSec,
        sentences: sentenceItems,
      };

      chapterSections.push(section);
      allSections.push(section);
      globalSectionIndex++;
      subSectionNum++;

      currentSectionSentences = [];
      currentSectionWords = 0;
    };

    for (const sentence of chapterSentences) {
      // If adding this sentence exceeds targetWordsPerSection and we already have substantial text
      if (currentSectionWords > 0 && currentSectionWords + sentence.wordCount > targetWordsPerSection * 1.15) {
        flushSection();
      }

      currentSectionSentences.push(sentence);
      currentSectionWords += sentence.wordCount;

      // If we crossed target words, we can cleanly cut here on this sentence boundary!
      if (currentSectionWords >= targetWordsPerSection) {
        flushSection();
      }
    }

    // Flush any remaining sentences in chapter
    flushSection();

    const chapterWordCount = chapterSections.reduce((acc, s) => acc + s.wordCount, 0);
    chapters.push({
      id: `chap-${chapIdx}`,
      chapterIndex: chapIdx,
      title: rawChap.title,
      sections: chapterSections,
      totalWords: chapterWordCount,
    });
  });

  const totalEstimatedMinutes = Math.round(totalBookWords / wordsPerMinute);

  return {
    id: bookId,
    title: title || 'Untitled Book',
    author: author,
    language: language,
    totalWords: totalBookWords,
    totalEstimatedMinutes: totalEstimatedMinutes,
    targetMinutesPerSection: targetMinutes,
    chapters,
    sections: allSections,
    coverGradient: gradient,
  };
}
