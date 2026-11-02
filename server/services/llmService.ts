/**
 * LLM Service
 * 
 * Powered by Gemini (GEMINI_API_KEY) for:
 * 1. Book Question-Answering (RAG grounded in retrieved book chunks)
 * 2. 30-Second Section Recaps
 * 3. Interactive Quiz Generation
 * 4. Spaced Repetition Flashcards
 * 5. Simple Hinglish / Conversational Explanations
 * 
 * Clean provider structure maintained so LLM backend can be swapped in future.
 */

import { isGeminiConfigured } from '../config/gnani.js';
import { GoogleGenAI, Type } from '@google/genai';
import { BookChunk } from './ragService.js';

export interface AskBookRequest {
  question: string;
  bookTitle: string;
  chunks: BookChunk[];
  language?: string; // 'en', 'hi', 'hinglish', etc.
}

export interface AskBookResponse {
  answer: string;
  citations: {
    sectionId: string;
    sectionTitle: string;
    relevantExcerpt: string;
  }[];
  modelUsed: 'gemini-2.5-flash';
}

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

export interface StudyPackResponse {
  recap30s: string;
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
  simpleExplanationHinglish: string;
  modelUsed: 'gemini-2.5-flash' | 'local-extractor';
}

/**
 * Ask a question grounded strictly in retrieved book chunks
 */
export async function askBook(params: AskBookRequest): Promise<AskBookResponse> {
  const { question, bookTitle, chunks, language = 'en' } = params;

  // Build grounded context
  const contextText = chunks
    .map(
      (c, idx) =>
        `[Source ${idx + 1}: Section "${c.sectionTitle}"]\n${c.text}`
    )
    .join('\n\n');

  const systemPrompt = `You are Pushtak.fm's Book Companion, providing answers powered by Gemini.
You answer the user's questions about the book "${bookTitle}" STRICTLY and EXCLUSIVELY based on the provided context sections below.
Rules:
1. Grounding: Rely ONLY on the provided context. If the answer is not contained in the excerpts, clearly and politely say: "The provided sections of the book do not mention this."
2. Tone: Calm, articulate, intellectual, and warm (like a personal tutor reading alongside you).
3. Language: If the user asks in Hindi or Hinglish, or if requested, respond in natural, friendly Hindi/Hinglish. Otherwise, respond in clear English.
4. Keep the answer concise (2-4 paragraphs max), suitable for being read aloud.`;

  const userPrompt = `Context excerpts from "${bookTitle}":
${contextText || 'No direct matching sections found in book.'}

User Question: "${question}"

Provide a clear, direct answer grounded in the excerpts above.`;

  // Use Gemini API
  if (isGeminiConfigured()) {
    try {
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
          { text: systemPrompt },
          { text: userPrompt },
        ],
        config: {
          temperature: 0.3,
        },
      });

      const answer = response.text || 'Unable to generate an answer at this moment.';

      // Build citations from used chunks
      const citations = chunks.map((c) => ({
        sectionId: c.sectionId,
        sectionTitle: c.sectionTitle,
        relevantExcerpt: c.text.slice(0, 160) + '...',
      }));

      return {
        answer,
        citations,
        modelUsed: 'gemini-2.5-flash',
      };
    } catch (err: any) {
      console.error('[Gemini LLM] Error answering question:', err);
      throw new Error(`Gemini Q&A failed: ${err.message}`);
    }
  }

  // Fallback if no Gemini key
  return {
    answer: `Gemini API key is not configured. Here are the most relevant excerpts found in "${bookTitle}":\n\n` +
      chunks.slice(0, 2).map((c) => `• From "${c.sectionTitle}": "${c.text.slice(0, 200)}..."`).join('\n\n'),
    citations: chunks.map((c) => ({
      sectionId: c.sectionId,
      sectionTitle: c.sectionTitle,
      relevantExcerpt: c.text.slice(0, 160) + '...',
    })),
    modelUsed: 'gemini-2.5-flash',
  };
}

/**
 * Generate complete Student Study Pack for a section
 */
export async function generateStudentStudyPack(params: {
  sectionTitle: string;
  sectionText: string;
  language?: string;
}): Promise<StudyPackResponse> {
  const { sectionTitle, sectionText } = params;

  if (isGeminiConfigured()) {
    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `You are an expert tutor creating study materials for a book chapter section.
Section Title: "${sectionTitle}"
Content:
"""
${sectionText.slice(0, 8000)}
"""

Generate a complete study pack adhering to this exact JSON schema:
1. "recap30s": A punchy, 3-4 sentence spoken summary (approx 60-80 words) that can be read aloud in 30 seconds.
2. "simpleExplanationHinglish": A crystal-clear explanation using natural, warm conversational Hinglish (Hindi words in Roman English script like "Yeh concept samajhne ke liye...") that makes complex ideas instantly understandable.
3. "quiz": An array of 3 multiple-choice questions testing comprehension. Each with:
   - "question" (string)
   - "options" (array of 4 distinct strings)
   - "correctAnswerIndex" (number, 0 to 3)
   - "explanation" (1-2 sentences explaining why the correct answer is right)
4. "flashcards": An array of 3-4 flashcards with "front" (key concept/term/question) and "back" (crisp definition/answer).`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recap30s: { type: Type.STRING },
              simpleExplanationHinglish: { type: Type.STRING },
              quiz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctAnswerIndex: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                  },
                  required: ['question', 'options', 'correctAnswerIndex', 'explanation'],
                },
              },
              flashcards: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    front: { type: Type.STRING },
                    back: { type: Type.STRING },
                  },
                  required: ['front', 'back'],
                },
              },
            },
            required: ['recap30s', 'simpleExplanationHinglish', 'quiz', 'flashcards'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        recap30s: parsed.recap30s || `This section examines key themes of ${sectionTitle}.`,
        simpleExplanationHinglish: parsed.simpleExplanationHinglish || 'Is section ka main point yeh hai ki focus aur steady pace se bada result milta hai.',
        quiz: parsed.quiz || [],
        flashcards: parsed.flashcards || [],
        modelUsed: 'gemini-2.5-flash',
      };
    } catch (err: any) {
      console.warn('[Gemini StudyPack] Generation error:', err);
    }
  }

  // Fallback heuristic generator if offline
  return {
    recap30s: `In "${sectionTitle}", the text presents core concepts through practical analysis. Key insights emphasize methodical discipline, structured attention, and steady execution.`,
    simpleExplanationHinglish: `Is section mein sabse zaroori baat yeh hai ki bina distraction ke focus maintain karein. Chhote regular steps se deep understanding banti hai.`,
    quiz: [
      {
        question: `What is the central focus of "${sectionTitle}"?`,
        options: [
          'Developing deep sustained focus',
          'Rushing through chapters quickly',
          'Ignoring core principles',
          'Multitasking continuously',
        ],
        correctAnswerIndex: 0,
        explanation: 'The text emphasizes disciplined focus over fragmented attention.',
      },
    ],
    flashcards: [
      {
        front: 'Key Principle',
        back: 'Deep, uninterrupted focus delivers superior retention.',
      },
    ],
    modelUsed: 'local-extractor',
  };
}
