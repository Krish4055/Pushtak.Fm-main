/**
 * Render PostgreSQL Database Service
 * 
 * Simple, zero-maintenance database adapter for Pushtak.fm:
 * - If DATABASE_URL is set (Render auto-injects this when PostgreSQL is added):
 *   Automatically creates tables on boot and persists books, RAG chunks, and study packs.
 * - If DATABASE_URL is not set (Local dev without Postgres):
 *   Gracefully falls back to in-memory storage with zero errors or crashes.
 */

import pg from 'pg';
import { ParsedBook, BookChunk, StudyPack } from '../../src/types/index.js';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let isConnected = false;

/**
 * Initializes PostgreSQL database connection and creates required tables if needed.
 */
export async function initDatabase(): Promise<boolean> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString || !connectionString.trim()) {
    console.log('[Database] No DATABASE_URL found. Running with in-memory storage (ideal for local development).');
    isConnected = false;
    return false;
  }

  try {
    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    const res = await client.query('SELECT NOW()');
    client.release();

    console.log(`[Database] Connected to PostgreSQL on Render at ${res.rows[0].now}`);

    // Create tables automatically
    await createTables();
    isConnected = true;
    return true;
  } catch (err: any) {
    console.warn(`[Database] PostgreSQL connection failed: ${err.message}. Falling back to in-memory mode.`);
    isConnected = false;
    return false;
  }
}

/**
 * Creates lightweight schema for Pushtak.fm
 */
async function createTables(): Promise<void> {
  if (!pool) return;

  const queries = [
    // 1. Books table
    `CREATE TABLE IF NOT EXISTS books (
      id VARCHAR(64) PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      language VARCHAR(16) DEFAULT 'en',
      cover_gradient TEXT,
      total_words INT,
      target_minutes INT DEFAULT 10,
      sections JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    // 2. Book Chunks table (for RAG / Ask the Book)
    `CREATE TABLE IF NOT EXISTS book_chunks (
      id VARCHAR(64) PRIMARY KEY,
      book_id VARCHAR(64) REFERENCES books(id) ON DELETE CASCADE,
      section_id VARCHAR(64) NOT NULL,
      chapter_title TEXT,
      section_title TEXT,
      chunk_index INT NOT NULL,
      text TEXT NOT NULL,
      word_count INT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS idx_book_chunks_book_id ON book_chunks(book_id);`,

    // 3. Study Packs table (persisting generated quizzes, key terms, flashcards)
    `CREATE TABLE IF NOT EXISTS study_packs (
      section_id VARCHAR(64) PRIMARY KEY,
      book_id VARCHAR(64) NOT NULL,
      pack JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE INDEX IF NOT EXISTS idx_study_packs_book_id ON study_packs(book_id);`,
  ];

  for (const q of queries) {
    await pool.query(q);
  }

  console.log('[Database] Schema verified and tables ready (books, book_chunks, study_packs).');
}

export function isDatabaseConnected(): boolean {
  return isConnected && pool !== null;
}

/**
 * Saves a parsed book to PostgreSQL
 */
export async function saveBookToDB(book: ParsedBook): Promise<void> {
  if (!isDatabaseConnected() || !pool) return;

  const query = `
    INSERT INTO books (id, title, author, language, cover_gradient, total_words, target_minutes, sections)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      author = EXCLUDED.author,
      language = EXCLUDED.language,
      cover_gradient = EXCLUDED.cover_gradient,
      total_words = EXCLUDED.total_words,
      target_minutes = EXCLUDED.target_minutes,
      sections = EXCLUDED.sections;
  `;

  await pool.query(query, [
    book.id,
    book.title,
    book.author,
    book.language || 'en',
    book.coverGradient,
    book.totalWords,
    book.targetMinutes || 10,
    JSON.stringify(book.sections),
  ]);
}

/**
 * Retrieves a parsed book by ID from PostgreSQL
 */
export async function getBookFromDB(id: string): Promise<ParsedBook | null> {
  if (!isDatabaseConnected() || !pool) return null;

  const query = `SELECT * FROM books WHERE id = $1 LIMIT 1;`;
  const res = await pool.query(query, [id]);

  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    language: row.language,
    coverGradient: row.cover_gradient,
    totalWords: row.total_words,
    targetMinutes: row.target_minutes,
    sections: row.sections,
  };
}

/**
 * Saves RAG chunks for a book
 */
export async function saveBookChunksToDB(bookId: string, chunks: BookChunk[]): Promise<void> {
  if (!isDatabaseConnected() || !pool || chunks.length === 0) return;

  // Use transaction to delete old chunks and insert new ones
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM book_chunks WHERE book_id = $1', [bookId]);

    const insertQuery = `
      INSERT INTO book_chunks (id, book_id, section_id, chapter_title, section_title, chunk_index, text, word_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8);
    `;

    for (const chunk of chunks) {
      await client.query(insertQuery, [
        chunk.id,
        chunk.bookId,
        chunk.sectionId,
        chunk.chapterTitle,
        chunk.sectionTitle,
        chunk.chunkIndex,
        chunk.text,
        chunk.wordCount,
      ]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Retrieves all RAG chunks for a book
 */
export async function getBookChunksFromDB(bookId: string): Promise<BookChunk[]> {
  if (!isDatabaseConnected() || !pool) return [];

  const query = `
    SELECT id, book_id, section_id, chapter_title, section_title, chunk_index, text, word_count
    FROM book_chunks
    WHERE book_id = $1
    ORDER BY chunk_index ASC;
  `;

  const res = await pool.query(query, [bookId]);

  return res.rows.map((row) => ({
    id: row.id,
    bookId: row.book_id,
    sectionId: row.section_id,
    chapterTitle: row.chapter_title,
    sectionTitle: row.section_title,
    chunkIndex: row.chunk_index,
    text: row.text,
    wordCount: row.word_count,
  }));
}

/**
 * Saves a generated Study Pack
 */
export async function saveStudyPackToDB(sectionId: string, bookId: string, pack: StudyPack): Promise<void> {
  if (!isDatabaseConnected() || !pool) return;

  const query = `
    INSERT INTO study_packs (section_id, book_id, pack, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (section_id) DO UPDATE SET
      book_id = EXCLUDED.book_id,
      pack = EXCLUDED.pack,
      updated_at = NOW();
  `;

  await pool.query(query, [sectionId, bookId, JSON.stringify(pack)]);
}

/**
 * Retrieves a Study Pack for a section
 */
export async function getStudyPackFromDB(sectionId: string): Promise<StudyPack | null> {
  if (!isDatabaseConnected() || !pool) return null;

  const query = `SELECT pack FROM study_packs WHERE section_id = $1 LIMIT 1;`;
  const res = await pool.query(query, [sectionId]);

  if (res.rows.length === 0) return null;
  return res.rows[0].pack;
}

