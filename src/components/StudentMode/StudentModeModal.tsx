import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Sparkles,
  BookOpen,
  CheckCircle2,
  XCircle,
  RotateCw,
  Bookmark,
  Download,
  Volume2,
  X,
  HelpCircle,
  FileText,
  Calendar,
  Play,
} from 'lucide-react';
import { ParsedBook, BookSection, StudyPack, QuizQuestion, Flashcard } from '../../types';
import {
  getStudyPack,
  saveStudyPack,
  getNotesForBook,
  BookNote,
  saveSpacedCard,
  getCardsDueForReview,
  SpacedReviewCard,
} from '../../services/db';
import { audioPlayer } from '../../services/audioPlayer';
import { useToast } from '../Toast';

interface StudentModeModalProps {
  isOpen: boolean;
  book: ParsedBook;
  currentSection: BookSection;
  onClose: () => void;
  snippetToExplain?: { text: string; style: 'simple' | 'hindi' | 'hinglish' } | null;
}

export const StudentModeModal: React.FC<StudentModeModalProps> = ({
  isOpen,
  book,
  currentSection,
  onClose,
  snippetToExplain,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'studyPack' | 'spacedReview' | 'notes' | 'explain'>(
    snippetToExplain ? 'explain' : 'studyPack'
  );

  // Study Pack State
  const [studyPack, setStudyPack] = useState<StudyPack | null>(null);
  const [isLoadingPack, setIsLoadingPack] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);

  // Quiz State
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Flashcards State
  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [cardReviewQueue, setCardReviewQueue] = useState<SpacedReviewCard[]>([]);

  // Notes State
  const [bookNotes, setBookNotes] = useState<BookNote[]>([]);

  // Explanation state
  const [snippetAnswer, setSnippetAnswer] = useState<string | null>(null);
  const [isExplainingSnippet, setIsExplainingSnippet] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSectionStudyPack();
      loadSavedNotes();
      loadDueCards();
    }
  }, [isOpen, currentSection.id]);

  useEffect(() => {
    if (snippetToExplain) {
      setActiveTab('explain');
      explainSnippet(snippetToExplain.text, snippetToExplain.style);
    }
  }, [snippetToExplain]);

  const loadSectionStudyPack = async () => {
    setIsLoadingPack(true);
    setPackError(null);
    setQuizAnswers({});
    setQuizSubmitted(false);
    setFlippedCards({});

    try {
      // 1. Check IndexedDB first
      const existing = await getStudyPack(currentSection.id);
      if (existing) {
        setStudyPack(existing);
        setIsLoadingPack(false);
        return;
      }

      // 2. Request generation from backend Evon v3.3
      const resp = await fetch('/api/student/study-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: currentSection.title,
          sectionText: currentSection.text,
          language: book.language,
        }),
      });

      if (!resp.ok) {
        throw new Error('Study pack generation failed.');
      }

      const pack: StudyPack = await resp.json();
      setStudyPack(pack);
      // Persist in IndexedDB
      await saveStudyPack(currentSection.id, book.id, pack);
    } catch (err: any) {
      console.warn('[StudentMode] Pack error:', err);
      setPackError(err.message || 'Could not load study pack.');
    } finally {
      setIsLoadingPack(false);
    }
  };

  const loadSavedNotes = async () => {
    const notes = await getNotesForBook(book.id);
    setBookNotes(notes.sort((a, b) => b.createdAt - a.createdAt));
  };

  const loadDueCards = async () => {
    const cards = await getCardsDueForReview();
    setCardReviewQueue(cards);
  };

  // Explain specific paragraph in simple / hindi / hinglish
  const explainSnippet = async (text: string, style: 'simple' | 'hindi' | 'hinglish') => {
    setIsExplainingSnippet(true);
    setSnippetAnswer(null);

    const stylePrompt =
      style === 'hinglish'
        ? 'Explain this paragraph casually in natural Hinglish (Hindi + English mix)'
        : style === 'hindi'
        ? 'Explain this paragraph clearly in formal Hindi'
        : 'Explain this paragraph simply like I am 12 years old with a practical real-world analogy';

    try {
      const resp = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `${stylePrompt}: "${text}"`,
          bookId: book.id,
          bookTitle: book.title,
          language: style === 'hindi' ? 'hi' : 'en',
          fallbackContext: text,
        }),
      });

      const data = await resp.json();
      setSnippetAnswer(data.answer);
    } catch {
      setSnippetAnswer('Could not generate explanation. Please try again.');
    } finally {
      setIsExplainingSnippet(false);
    }
  };

  // Spaced repetition: Mark card as easy or review again tomorrow
  const handleCardFeedback = async (card: Flashcard, difficulty: 'easy' | 'hard') => {
    const nextIntervalMs = difficulty === 'easy' ? 3 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const reviewCard: SpacedReviewCard = {
      id: `card-${Math.random().toString(36).substring(2, 9)}`,
      bookId: book.id,
      sectionId: currentSection.id,
      front: card.front,
      back: card.back,
      difficulty,
      nextReviewDate: Date.now() + nextIntervalMs,
      reviewCount: 1,
    };

    await saveSpacedCard(reviewCard);
    showToast(
      difficulty === 'easy'
        ? 'Great! Scheduled for review in 3 days.'
        : 'Saved to "Review Today" queue for spaced repetition.',
      'info'
    );
  };

  // Export bookmarks and notes as .txt / markdown
  const handleExportNotes = () => {
    if (bookNotes.length === 0) {
      showToast('No notes to export yet.', 'info');
      return;
    }

    const content = `# Student Notes & Bookmarks: ${book.title}\nAuthor: ${book.author}\nExported: ${new Date().toLocaleString()}\n\n` +
      bookNotes
        .map(
          (n, i) =>
            `## ${i + 1}. [${n.type.toUpperCase()}] ${n.sectionTitle}\nSaved: ${new Date(
              n.createdAt
            ).toLocaleDateString()}\n\n> "${n.content}"\n`
        )
        .join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title.replace(/\s+/g, '_')}_Student_Notes.md`;
    a.click();
    showToast('Exported notes file successfully!', 'success');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-3xl h-[88vh] rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--text-primary)] font-ui">
                  Student Learning Mode
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  Evon v3.3
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-sm">
                Recap, 3-Question Quiz & Spaced Flashcards for "{currentSection.title}"
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('studyPack')}
            className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 -mb-[1px] ${
              activeTab === 'studyPack'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Section Study Pack</span>
          </button>

          <button
            onClick={() => setActiveTab('spacedReview')}
            className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 -mb-[1px] ${
              activeTab === 'spacedReview'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Review Today ({cardReviewQueue.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('notes')}
            className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 -mb-[1px] ${
              activeTab === 'notes'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Bookmarks & Notes ({bookNotes.length})</span>
          </button>

          {snippetToExplain && (
            <button
              onClick={() => setActiveTab('explain')}
              className={`pb-3 px-3 text-xs font-bold transition flex items-center gap-1.5 border-b-2 -mb-[1px] ${
                activeTab === 'explain'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Deep Explain</span>
            </button>
          )}
        </div>

        {/* Tab 1: Section Study Pack */}
        {activeTab === 'studyPack' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoadingPack ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs font-semibold text-[var(--text-muted)]">
                  Evon v3.3 is generating your 30-sec recap, quiz & flashcards...
                </p>
              </div>
            ) : packError ? (
              <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
                <span>{packError}</span>
                <button
                  onClick={loadSectionStudyPack}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition"
                >
                  Retry
                </button>
              </div>
            ) : studyPack ? (
              <>
                {/* 30-Second Audio Recap */}
                <div className="p-5 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      30-Second Audio Recap
                    </span>
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined' && window.speechSynthesis) {
                          const utt = new SpeechSynthesisUtterance(studyPack.recap30s);
                          window.speechSynthesis.speak(utt);
                        }
                      }}
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition flex items-center gap-1 shadow-sm"
                    >
                      <Volume2 className="w-3 h-3" /> Listen
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-emerald-950 dark:text-emerald-100 font-reading leading-relaxed">
                    "{studyPack.recap30s}"
                  </p>
                </div>

                {/* Casual Hinglish Breakdown */}
                {studyPack.simpleExplanationHinglish && (
                  <div className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-xs">
                    <p className="font-bold text-[var(--text-primary)] mb-1 flex items-center gap-1.5 text-blue-500">
                      <span>Simple Explanation (Hinglish)</span>
                    </p>
                    <p className="text-[var(--text-secondary)] font-reading leading-relaxed">
                      {studyPack.simpleExplanationHinglish}
                    </p>
                  </div>
                )}

                {/* 3-Question Interactive Quiz */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-[var(--text-primary)] font-ui flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-emerald-500" />
                      3-Question Concept Quiz
                    </h4>
                    {quizSubmitted && (
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Score:{' '}
                        {
                          Object.entries(quizAnswers).filter(
                            ([qIdx, ans]) =>
                              studyPack.quiz[Number(qIdx)]?.correctAnswerIndex === ans
                          ).length
                        }{' '}
                        / 3
                      </span>
                    )}
                  </div>

                  <div className="space-y-4">
                    {studyPack.quiz.map((q, qIdx) => (
                      <div
                        key={qIdx}
                        className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm"
                      >
                        <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] mb-3">
                          {qIdx + 1}. {q.question}
                        </p>

                        <div className="space-y-2">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = quizAnswers[qIdx] === optIdx;
                            const isCorrect = q.correctAnswerIndex === optIdx;

                            let btnStyle =
                              'border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]';
                            if (quizSubmitted) {
                              if (isCorrect) {
                                btnStyle =
                                  'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold';
                              } else if (isSelected && !isCorrect) {
                                btnStyle =
                                  'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300';
                              }
                            } else if (isSelected) {
                              btnStyle =
                                'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-600 font-bold';
                            }

                            return (
                              <button
                                key={optIdx}
                                disabled={quizSubmitted}
                                onClick={() => setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx })}
                                className={`w-full text-left p-2.5 rounded-xl border text-xs transition flex items-center justify-between ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {quizSubmitted && isCorrect && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                )}
                                {quizSubmitted && isSelected && !isCorrect && (
                                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {quizSubmitted && (
                          <p className="text-[11px] text-[var(--text-muted)] mt-2 italic bg-[var(--bg-surface-elevated)] p-2 rounded-lg">
                            Explanation: {q.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {!quizSubmitted ? (
                    <button
                      onClick={() => setQuizSubmitted(true)}
                      disabled={Object.keys(quizAnswers).length < 3}
                      className="mt-4 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs shadow-md transition"
                    >
                      Submit Quiz
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setQuizSubmitted(false);
                        setQuizAnswers({});
                      }}
                      className="mt-4 w-full py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition flex items-center justify-center gap-1.5"
                    >
                      <RotateCw className="w-3.5 h-3.5" /> Retake Quiz
                    </button>
                  )}
                </div>

                {/* 4 Interactive Flashcards */}
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] font-ui mb-3">
                    Spaced Repetition Flashcards (Tap to Flip)
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {studyPack.flashcards.map((card, cIdx) => {
                      const isFlipped = flippedCards[cIdx];
                      return (
                        <div
                          key={cIdx}
                          onClick={() =>
                            setFlippedCards({ ...flippedCards, [cIdx]: !isFlipped })
                          }
                          className="min-h-[140px] p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm hover:shadow-md cursor-pointer transition-all flex flex-col justify-between"
                        >
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                              {isFlipped ? 'Takeaway (Back)' : 'Concept (Front)'}
                            </span>
                            <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] mt-1 font-reading">
                              {isFlipped ? card.back : card.front}
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[11px]">
                            <span className="text-[10px] text-[var(--text-muted)]">Tap to flip</span>
                            {isFlipped && (
                              <div
                                className="flex items-center gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  onClick={() => handleCardFeedback(card, 'hard')}
                                  className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 text-[10px] font-bold hover:bg-amber-500/20"
                                >
                                  Review Again
                                </button>
                                <button
                                  onClick={() => handleCardFeedback(card, 'easy')}
                                  className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-bold hover:bg-emerald-500/20"
                                >
                                  Got It
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Tab 2: Spaced Repetition "Review Today" */}
        {activeTab === 'spacedReview' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                Cards Scheduled for Review Today
              </h4>
              <span className="text-xs text-[var(--text-muted)]">
                {cardReviewQueue.length} cards due
              </span>
            </div>

            {cardReviewQueue.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-[var(--text-primary)]">All Caught Up!</p>
                <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto mt-1 font-reading">
                  No flashcards due right now. Flashcards you mark "Review Again" during section study will show up here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {cardReviewQueue.map((card) => (
                  <div
                    key={card.id}
                    className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <p className="text-xs font-bold text-emerald-600 mb-1">{card.front}</p>
                      <p className="text-xs text-[var(--text-primary)] font-reading">{card.back}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Notes & Bookmarks */}
        {activeTab === 'notes' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-[var(--text-primary)]">
                  Bookmarks & Voice Notes
                </h4>
                <p className="text-xs text-[var(--text-muted)]">
                  Saved notes for "{book.title}"
                </p>
              </div>
              <button
                onClick={handleExportNotes}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export as Markdown</span>
              </button>
            </div>

            {bookNotes.length === 0 ? (
              <div className="py-16 text-center text-xs text-[var(--text-muted)]">
                <Bookmark className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                <p className="font-bold text-[var(--text-primary)]">No bookmarks saved yet</p>
                <p className="mt-1 font-reading">
                  Right-click any sentence while listening or say "bookmark this" to save notes!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bookNotes.map((note) => {
                  const formatTime = (secs: number) => {
                    const m = Math.floor(secs / 60);
                    const s = Math.floor(secs % 60);
                    return `${m}:${s < 10 ? '0' : ''}${s}`;
                  };
                  return (
                    <div
                      key={note.id}
                      className="p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-[#C2562F]">
                            {note.sectionTitle}
                          </span>
                          <span className="px-2 py-0.5 rounded-lg bg-[#FAEDE7] text-[#C2562F] text-[10px] font-mono font-bold">
                            ⏱ {formatTime(note.timestampSeconds)}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            Sentence #{note.sentenceIndex + 1}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {new Date(note.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-primary)] font-reading leading-relaxed border-l-2 border-[#C2562F] pl-2.5">
                        "{note.content}"
                      </p>
                      {note.userNote && (
                        <div className="p-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 text-xs text-[var(--text-secondary)]">
                          <strong className="text-amber-800 dark:text-amber-300 mr-1">Note:</strong>
                          {note.userNote}
                        </div>
                      )}
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => {
                            const sec =
                              book.sections.find((s) => s.id === note.sectionId) || currentSection;
                            audioPlayer.playSection(book, sec, note.sentenceIndex, note.timestampSeconds);
                            showToast(`Playing from ${formatTime(note.timestampSeconds)}`, 'info');
                            onClose();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white text-xs font-semibold transition"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>Play from {formatTime(note.timestampSeconds)}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Deep Paragraph Explanation */}
        {activeTab === 'explain' && (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs">
              <span className="font-bold text-blue-600 block mb-1">Selected Sentence:</span>
              <p className="font-reading text-[var(--text-primary)] italic">
                "{snippetToExplain?.text}"
              </p>
            </div>

            {isExplainingSnippet ? (
              <div className="py-12 text-center text-xs text-[var(--text-muted)] flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <span>Evon v3.3 is crafting a clear breakdown...</span>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-sm font-reading leading-relaxed">
                {snippetAnswer}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
