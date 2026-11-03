import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { extractTextFromFile, processBookText } from './server/services/bookParser.js';
import { synthesizeSectionSpeech } from './server/services/ttsService.js';
import { transcribeAudio } from './server/services/sttService.js';
import { askBook, generateStudentStudyPack } from './server/services/llmService.js';
import { chunkSection, retrieveRelevantChunks, BookChunk } from './server/services/ragService.js';
import { getPreloadedDemoBook } from './server/data/demoBook.js';
import { GNANI_CONFIG, isGnaniConfigured, isGeminiConfigured } from './server/config/gnani.js';
import { getAvailableVoices, getDefaultVoiceId } from './server/services/voiceService.js';

dotenv.config();

// Crash prevention handlers to ensure server never dies on external network glitches
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception caught to prevent process death:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Body parser middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory RAG chunk store per book
const bookChunksStore = new Map<string, BookChunk[]>();

// Preload demo book chunks
const demoBook = getPreloadedDemoBook(5);
const demoChunks: BookChunk[] = [];
for (const sec of demoBook.sections) {
  demoChunks.push(...chunkSection(sec.id, sec.title, sec.chapterTitle, sec.text));
}
bookChunksStore.set(demoBook.id, demoChunks);

// Multer upload config
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Helper to generate a tiny valid 1-second 16kHz mono WAV buffer for diagnostic testing
function createTinyDiagnosticWav(): Buffer {
  const sampleRate = 16000;
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const numSamples = sampleRate * 1; // 1 second
  const pcmBytes = numSamples * numChannels * bytesPerSample;

  const buffer = Buffer.alloc(44 + pcmBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + pcmBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(pcmBytes, 40);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 8000);
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  return buffer;
}

// --- API ROUTES ---

// Health & Model Status
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    app: 'Pushtak.fm',
    models: {
      tts: {
        engine: 'Gnani Timbre v3.0 (timbre-v3.0)',
        configured: isGnaniConfigured(),
        fallback: 'Browser Natural Speech API',
      },
      stt: {
        engine: 'Gnani Prisma v3.0 (prisma-v3.0)',
        configured: isGnaniConfigured(),
        fallback: isGeminiConfigured() ? 'Gemini 2.5 Flash Transcribe' : 'Browser Speech Recognition',
      },
      llm: {
        engine: 'Gemini 2.5 Flash',
        configured: isGeminiConfigured(),
        provider: 'Google GenAI SDK',
      },
    },
  });
});

// Diagnostics endpoint (development only)
app.get('/api/diagnostics', async (req: Request, res: Response) => {
  const result: {
    tts: { pass: boolean; httpStatus: number; error: string | null; bytesReceived?: number };
    stt: { pass: boolean; httpStatus: number; error: string | null; transcript?: string };
  } = {
    tts: { pass: false, httpStatus: 0, error: null },
    stt: { pass: false, httpStatus: 0, error: null },
  };

  // 1. Diagnostic TTS call with Lakshmi
  try {
    const ttsPayload = {
      text: 'Testing Timbre.',
      voice: 'Lakshmi',
      model: 'timbre-v3.0',
      language: 'auto',
      speed: 1.0,
      audio_config: {
        sample_rate: 24000,
        num_channels: 1,
        sample_width: 2,
        encoding: 'linear_pcm',
        container: 'wav',
      },
    };

    const ttsResp = await fetch(GNANI_CONFIG.tts.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key-ID': GNANI_CONFIG.apiKey,
      },
      body: JSON.stringify(ttsPayload),
      signal: AbortSignal.timeout(10000),
    });

    result.tts.httpStatus = ttsResp.status;
    if (ttsResp.ok) {
      const arrBuf = await ttsResp.arrayBuffer();
      result.tts.pass = true;
      result.tts.bytesReceived = arrBuf.byteLength;
    } else {
      result.tts.error = await ttsResp.text();
    }
  } catch (err: any) {
    result.tts.error = err.message || 'TTS diagnostic network error';
  }

  // Grace pause (350ms) to respect Gnani 1-active-request constraint
  await new Promise((r) => setTimeout(r, 350));

  // 2. Diagnostic STT call with tiny generated WAV
  try {
    const tinyWav = createTinyDiagnosticWav();
    const sttForm = new FormData();
    sttForm.append('audio_file', new Blob([new Uint8Array(tinyWav)], { type: 'audio/wav' }), 'diagnostic.wav');
    sttForm.append('model', 'prisma-v3.0');
    sttForm.append('language_code', 'indic-auto');

    const sttResp = await fetch(GNANI_CONFIG.stt.endpoint, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': GNANI_CONFIG.apiKey,
      },
      body: sttForm,
      signal: AbortSignal.timeout(10000),
    });

    result.stt.httpStatus = sttResp.status;
    if (sttResp.ok) {
      const data = await sttResp.json() as any;
      result.stt.pass = true;
      result.stt.transcript = data.transcript || data.text || '';
    } else {
      result.stt.error = await sttResp.text();
    }
  } catch (err: any) {
    result.stt.error = err.message || 'STT diagnostic network error';
  }

  res.json(result);
});

// Available Voices for Timbre v3.0
app.get('/api/voices', async (req: Request, res: Response) => {
  try {
    const result = await getAvailableVoices();
    res.json(result);
  } catch (err: any) {
    console.error('[Voices API] Error fetching voices:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch voices' });
  }
});

// Preloaded Demo Book
app.get('/api/demo-book', (req: Request, res: Response) => {
  const targetMinutes = parseInt(req.query.targetMinutes as string) || 5;
  const book = getPreloadedDemoBook(targetMinutes);
  res.json(book);
});

// Upload & Parse Book
app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    let title = req.body.title || 'Untitled Book';
    let rawText = '';
    const author = req.body.author || 'Uploaded Book';
    const targetMinutes = parseInt(req.body.targetMinutes) || 10;

    if (req.file) {
      console.log(`[Upload] Processing uploaded file: ${req.file.originalname} (${req.file.size} bytes)...`);
      const extracted = await extractTextFromFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      title = extracted.title || title;
      rawText = extracted.text;
    } else if (req.body.text) {
      console.log(`[Upload] Processing pasted text (${req.body.text.length} chars)...`);
      rawText = req.body.text;
    } else {
      return res.status(400).json({ error: 'No file or text provided for upload.' });
    }

    if (!rawText.trim()) {
      return res.status(400).json({ error: 'Uploaded content has no extractable text.' });
    }

    const parsedBook = processBookText(title, rawText, targetMinutes, author);

    // Return parsed book immediately to client to minimize upload wait time
    res.json(parsedBook);
    console.log(`[Upload] Book parsed: "${parsedBook.title}" - ${parsedBook.sections.length} sections, ${parsedBook.totalWords} words.`);

    // Index chunks for RAG asynchronously in background without blocking response
    setImmediate(() => {
      try {
        const bookChunks: BookChunk[] = [];
        for (const section of parsedBook.sections) {
          const chunks = chunkSection(section.id, section.title, section.chapterTitle, section.text);
          bookChunks.push(...chunks);
        }
        bookChunksStore.set(parsedBook.id, bookChunks);
        console.log(`[RAG Indexer] Indexed ${bookChunks.length} chunks for "${parsedBook.title}" (${parsedBook.id}) in background.`);
      } catch (ragErr) {
        console.error('[RAG Indexer] Background indexing error:', ragErr);
      }
    });
  } catch (error: any) {
    console.error('[Upload] Error processing book:', error);
    res.status(500).json({ error: error.message || 'Failed to parse book file.' });
  }
});

// Timbre v3.0 TTS Endpoint
app.post('/api/tts', async (req: Request, res: Response) => {
  try {
    const { text, language, voice, speed, sectionId } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text is required for TTS synthesis.' });
    }

    const result = await synthesizeSectionSpeech({
      text,
      language: language || 'auto',
      voice: voice || getDefaultVoiceId(),
      speed: parseFloat(speed) || 1.0,
      sectionId,
    });

    if (result.audioBuffer) {
      res.setHeader('Content-Type', result.audioContentType);
      res.setHeader('X-Voice-Engine', result.source);
      res.setHeader('X-Estimated-Duration', result.durationEstimateSeconds.toString());
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(result.audioBuffer);
    }

    // Truthful fallback response with HTTP status/reason
    res.json({
      useBrowserSpeech: true,
      source: result.source,
      message: result.message,
      gnaniFailed: result.gnaniFailed,
      gnaniStatus: result.gnaniStatus,
      gnaniReason: result.gnaniReason,
      durationEstimateSeconds: result.durationEstimateSeconds,
    });
  } catch (err: any) {
    console.error('[TTS] Synthesis error:', err);
    res.status(500).json({ error: err.message || 'Speech synthesis failed' });
  }
});

// Prisma v3.0 STT Endpoint
app.post('/api/stt', upload.single('audio_file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Audio file buffer is required for transcription.' });
    }

    const language = (req.body.language_code as string) || (req.body.language as string) || 'indic-auto';
    const result = await transcribeAudio({
      audioBuffer: file.buffer,
      mimeType: file.mimetype || 'audio/wav',
      originalFilename: file.originalname || 'recording.wav',
      language,
    });

    res.json(result);
  } catch (err: any) {
    console.error('[STT] Transcription error:', err);
    res.status(500).json({ error: err.message || 'Failed to transcribe audio' });
  }
});

// Ask the Book (Grounded RAG with Gemini)
app.post('/api/ask', async (req: Request, res: Response) => {
  try {
    const { question, bookId, bookTitle, language, currentSectionId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    // Retrieve chunks for this book
    let chunks = bookChunksStore.get(bookId) || [];

    // Fallback: demo book chunks
    if (chunks.length === 0 && bookId === 'demo-deep-focus') {
      chunks = demoChunks;
    }

    // If client supplied direct context chunks
    if (chunks.length === 0 && req.body.fallbackContext) {
      chunks = chunkSection(currentSectionId || 'current', 'Current Section', undefined, req.body.fallbackContext);
    }

    // Rank and retrieve top 4 chunks (BM25 + Semantic matching)
    const retrieved = retrieveRelevantChunks(question, chunks, 4);
    const topChunks = retrieved.map((r) => r.chunk);

    const askResponse = await askBook({
      question,
      bookTitle: bookTitle || 'Selected Book',
      chunks: topChunks,
      language: language || 'en',
    });

    res.json(askResponse);
  } catch (err: any) {
    console.error('[Ask] Error generating answer:', err);
    res.status(500).json({ error: err.message || 'Failed to generate answer' });
  }
});

// Student Study Pack (Recap, Quiz, Flashcards, Hinglish Explanation)
app.post('/api/study-pack', async (req: Request, res: Response) => {
  try {
    const { sectionTitle, sectionText, language } = req.body;

    if (!sectionText) {
      return res.status(400).json({ error: 'Section text is required to generate study pack.' });
    }

    const studyPack = await generateStudentStudyPack({
      sectionTitle: sectionTitle || 'Chapter Section',
      sectionText,
      language,
    });

    res.json(studyPack);
  } catch (err: any) {
    console.error('[Study Pack] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate study pack' });
  }
});

// --- SERVER SETUP (Vite middleware in dev, dist in prod) ---
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Pushtak.fm] Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[Pushtak.fm] Gnani AI Timbre v3.0 & Prisma v3.0 Configured: ${isGnaniConfigured() ? 'YES' : 'NO'}`);
  });
}

startServer();
