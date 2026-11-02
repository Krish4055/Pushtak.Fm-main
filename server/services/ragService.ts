/**
 * RAG (Retrieval-Augmented Generation) Service
 * 
 * Indexes book sections into semantic chunks (~200-350 words with overlap).
 * Evaluates semantic and BM25-style keyword relevance so only the top-k relevant
 * chunks are sent to Gnani Evon v3.3 (never the entire 500-page book!).
 */

export interface BookChunk {
  id: string;
  sectionId: string;
  sectionTitle: string;
  chapterTitle?: string;
  text: string;
  wordCount: number;
  keywords: Set<string>;
}

export interface RetrievedChunk {
  chunk: BookChunk;
  score: number;
}

/**
 * Tokenize text into normalized keywords (removing stopwords)
 */
function extractKeywords(text: string): Set<string> {
  const stopwords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'of', 'to',
    'for', 'with', 'as', 'by', 'that', 'this', 'it', 'from', 'be', 'are', 'was',
    'were', 'will', 'have', 'has', 'had', 'do', 'does', 'did', 'not', 'but',
    'what', 'how', 'why', 'who', 'when', 'where', 'me', 'my', 'you', 'your',
    'he', 'she', 'they', 'we', 'us', 'him', 'her', 'them', 'their', 'our',
    'ka', 'ki', 'ke', 'hai', 'hain', 'ho', 'tha', 'thi', 'the', 'ko', 'se', 'me', 'par'
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));

  return new Set(words);
}

/**
 * Create chunks from a section's text
 */
export function chunkSection(
  sectionId: string,
  sectionTitle: string,
  chapterTitle: string | undefined,
  text: string,
  chunkWordSize: number = 250,
  overlap: number = 40
): BookChunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: BookChunk[] = [];

  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + chunkWordSize, words.length);
    const chunkWords = words.slice(startIndex, endIndex);
    const chunkText = chunkWords.join(' ');

    chunks.push({
      id: `${sectionId}-chunk-${chunkIndex}`,
      sectionId,
      sectionTitle,
      chapterTitle,
      text: chunkText,
      wordCount: chunkWords.length,
      keywords: extractKeywords(chunkText),
    });

    if (endIndex >= words.length) break;
    startIndex += chunkWordSize - overlap;
    chunkIndex++;
  }

  return chunks;
}

/**
 * Retrieve top relevant chunks for a user question
 */
export function retrieveRelevantChunks(
  query: string,
  chunks: BookChunk[],
  topK: number = 4
): RetrievedChunk[] {
  const queryKeywords = extractKeywords(query);
  const queryLower = query.toLowerCase();

  const scored: RetrievedChunk[] = chunks.map((chunk) => {
    let score = 0;
    const chunkLower = chunk.text.toLowerCase();

    // Exact phrase match bonus
    if (queryLower.length > 5 && chunkLower.includes(queryLower)) {
      score += 15;
    }

    // Keyword overlap (BM25-style term frequency)
    for (const qWord of queryKeywords) {
      if (chunk.keywords.has(qWord)) {
        score += 3;
      }
      // Substring match
      if (chunkLower.includes(qWord)) {
        score += 1;
      }
    }

    // Header relevance
    if (chunk.sectionTitle.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    return { chunk, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
