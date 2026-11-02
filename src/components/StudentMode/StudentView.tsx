import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Bookmark,
  Download,
  RotateCw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Play,
  Trash2,
  Edit3,
  Plus,
  Clock,
  Filter,
  Volume2,
} from 'lucide-react';
import { ParsedBook, BookSection, StudyPack, Flashcard } from '../../types';
import {
  getStudyPack,
  saveStudyPack,
  getNotesForBook,
  BookNote,
  saveNote,
  deleteNote,
  saveSpacedCard,
  getCardsDueForReview,
  SpacedReviewCard,
} from '../../services/db';
import { audioPlayer } from '../../services/audioPlayer';
import { useToast } from '../Toast';

interface StudentViewProps {
  activeBook: ParsedBook | null;
  currentSection: BookSection | null;
  currentTime?: number;
  currentSentenceIndex?: number;
  onPlayBookmark?: (sectionId: string, timestampSeconds: number, sentenceIndex: number) => void;
  onOpenDemo: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  activeBook,
  currentSection,
  currentTime = 0,
  currentSentenceIndex = 0,
  onPlayBookmark,
  onOpenDemo,
}) => {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<'pack' | 'review' | 'notes'>('pack');

  const [studyPack, setStudyPack] = useState<StudyPack | null>(null);
  const [isLoadingPack, setIsLoadingPack] = useState(false);
  const [packError, setPackError] = useState<string | null>(null);

  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const [flippedCards, setFlippedCards] = useState<Record<number, boolean>>({});
  const [dueCards, setDueCards] = useState<SpacedReviewCard[]>([]);
  const [bookNotes, setBookNotes] = useState<BookNote[]>([]);

  // Notes & Bookmarks Tab state
  const [noteFilter, setNoteFilter] = useState<'all' | 'bookmarks' | 'annotated'>('all');
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<BookNote | null>(null);
  const [modalUserNote, setModalUserNote] = useState('');
  const [modalSectionId, setModalSectionId] = useState('');
  const [modalTimestamp, setModalTimestamp] = useState(0);
  const [modalSentenceIndex, setModalSentenceIndex] = useState(0);

  useEffect(() => {
    if (activeBook && currentSection) {
      loadPack(currentSection);
      loadNotes(activeBook.id);
      loadDue();
    }
  }, [activeBook?.id, currentSection?.id]);

  // Listen to cross-component note creation (e.g. from player)
  useEffect(() => {
    const handleNotesUpdated = (e: any) => {
      if (activeBook && (!e.detail?.bookId || e.detail.bookId === activeBook.id)) {
        loadNotes(activeBook.id);
      }
    };
    window.addEventListener('pushtak:notes-updated', handleNotesUpdated);
    return () => window.removeEventListener('pushtak:notes-updated', handleNotesUpdated);
  }, [activeBook?.id]);

  const loadPack = async (section: BookSection) => {
    setIsLoadingPack(true);
    setPackError(null);
    setQuizAnswers({});
    setQuizSubmitted(false);

    try {
      const cached = await getStudyPack(section.id);
      if (cached) {
        setStudyPack(cached);
        setIsLoadingPack(false);
        return;
      }

      const resp = await fetch('/api/student/study-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionTitle: section.title,
          sectionText: section.text,
          language: activeBook?.language || 'en',
        }),
      });

      if (!resp.ok) throw new Error('Failed to generate study pack.');
      const pack: StudyPack = await resp.json();
      setStudyPack(pack);
      if (activeBook) {
        await saveStudyPack(section.id, activeBook.id, pack);
      }
    } catch (err: any) {
      setPackError(err.message || 'Could not load study pack.');
    } finally {
      setIsLoadingPack(false);
    }
  };

  const loadNotes = async (bookId: string) => {
    const notes = await getNotesForBook(bookId);
    setBookNotes(notes.sort((a, b) => b.createdAt - a.createdAt));
  };

  const loadDue = async () => {
    const cards = await getCardsDueForReview();
    setDueCards(cards);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCardSpacedReview = async (card: Flashcard, diff: 'easy' | 'hard') => {
    if (!activeBook || !currentSection) return;
    const interval = diff === 'easy' ? 3 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    await saveSpacedCard({
      id: `card-${Math.random().toString(36).substring(2, 8)}`,
      bookId: activeBook.id,
      sectionId: currentSection.id,
      front: card.front,
      back: card.back,
      difficulty: diff,
      nextReviewDate: Date.now() + interval,
      reviewCount: 1,
    });
    showToast(diff === 'easy' ? 'Saved for review in 3 days.' : 'Added to Review Today.', 'info');
    loadDue();
  };

  // Play audio starting exactly from this bookmark's timestamp and sentence
  const handlePlayBookmark = (note: BookNote) => {
    if (!activeBook) return;

    if (onPlayBookmark) {
      onPlayBookmark(note.sectionId, note.timestampSeconds, note.sentenceIndex);
    } else {
      const section =
        activeBook.sections.find((s) => s.id === note.sectionId) ||
        currentSection ||
        activeBook.sections[0];
      audioPlayer.playSection(activeBook, section, note.sentenceIndex, note.timestampSeconds);
      showToast(`Playing "${note.sectionTitle}" from ${formatTime(note.timestampSeconds)}`, 'info');
    }
  };

  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
    if (activeBook) {
      loadNotes(activeBook.id);
    }
    showToast('Bookmark deleted.', 'info');
  };

  // Open modal to add note for current playback timestamp or custom section
  const handleOpenAddModal = () => {
    if (!activeBook || !currentSection) return;
    const curTime = Math.round(audioPlayer.getCurrentTime() || currentTime || 0);
    const curSentIdx = audioPlayer.getCurrentSentenceIndex() ?? currentSentenceIndex ?? 0;
    setEditingNote(null);
    setModalSectionId(currentSection.id);
    setModalTimestamp(curTime);
    setModalSentenceIndex(curSentIdx);
    setModalUserNote('');
    setIsAddNoteModalOpen(true);
  };

  // Open modal to edit existing bookmark user reflection
  const handleOpenEditModal = (note: BookNote) => {
    setEditingNote(note);
    setModalSectionId(note.sectionId);
    setModalTimestamp(note.timestampSeconds);
    setModalSentenceIndex(note.sentenceIndex);
    setModalUserNote(note.userNote || '');
    setIsAddNoteModalOpen(true);
  };

  const handleSaveModalNote = async () => {
    if (!activeBook) return;

    const targetSection =
      activeBook.sections.find((s) => s.id === modalSectionId) || currentSection || activeBook.sections[0];
    const sentence = targetSection.sentences[modalSentenceIndex] || {
      text: targetSection.title,
      wordCount: 0,
      startWordIndex: 0,
      id: `sent-${modalSentenceIndex}`,
    };

    if (editingNote) {
      // Update existing note
      const updated: BookNote = {
        ...editingNote,
        userNote: modalUserNote.trim() || undefined,
      };
      await saveNote(updated);
      showToast('Updated study note.', 'success');
    } else {
      // Create new bookmark/note
      const newNote: BookNote = {
        id: `note-${Date.now()}`,
        bookId: activeBook.id,
        sectionId: targetSection.id,
        sectionTitle: targetSection.title,
        timestampSeconds: modalTimestamp,
        sentenceIndex: modalSentenceIndex,
        type: 'bookmark',
        content: sentence.text,
        userNote: modalUserNote.trim() || undefined,
        createdAt: Date.now(),
      };
      await saveNote(newNote);
      showToast(`Saved bookmark at ${formatTime(modalTimestamp)}.`, 'success');
    }

    setIsAddNoteModalOpen(false);
    loadNotes(activeBook.id);
  };

  const handleExportNotes = () => {
    if (bookNotes.length === 0) {
      showToast('No bookmarks or notes to export.', 'info');
      return;
    }
    const content =
      `# Study Notes & Bookmarks: ${activeBook?.title}\n` +
      `Author: ${activeBook?.author || 'Unknown'}\n` +
      `Exported: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n` +
      `Total Bookmarks: ${bookNotes.length}\n\n---\n\n` +
      bookNotes
        .map((n, i) => {
          const timeStr = formatTime(n.timestampSeconds);
          let item = `### ${i + 1}. ${n.sectionTitle} — [${timeStr}] (Sentence #${n.sentenceIndex + 1})\n` +
            `*Saved on ${new Date(n.createdAt).toLocaleDateString()}*\n\n` +
            `> "${n.content}"\n`;
          if (n.userNote) {
            item += `\n**Study Reflection:** ${n.userNote}\n`;
          }
          return item;
        })
        .join('\n---\n\n');

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks_${(activeBook?.title || 'book').replace(/\s+/g, '_')}.md`;
    a.click();
    showToast('Exported Markdown notes file with timestamps!', 'success');
  };

  const filteredNotes = bookNotes.filter((n) => {
    if (noteFilter === 'bookmarks') return n.type === 'bookmark';
    if (noteFilter === 'annotated') return Boolean(n.userNote);
    return true;
  });

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl sm:text-2xl font-serif-heading font-bold text-[var(--text-primary)] tracking-tight">
          Student Learning Hub
        </h2>
        <p className="text-xs text-[var(--text-secondary)] mt-1 font-reading">
          {activeBook
            ? `Active study pack & saved bookmarks for "${currentSection?.title || activeBook.title}"`
            : 'Select a book to generate quizzes, flashcards, and recaps.'}
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
        <button
          onClick={() => setActiveSubTab('pack')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold font-ui transition tap-target ${
            activeSubTab === 'pack'
              ? 'bg-[#C2562F] text-white shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Section Pack
        </button>
        <button
          onClick={() => setActiveSubTab('review')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold font-ui transition tap-target ${
            activeSubTab === 'review'
              ? 'bg-[#C2562F] text-white shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Review Today ({dueCards.length})
        </button>
        <button
          onClick={() => setActiveSubTab('notes')}
          className={`flex-1 py-2 rounded-xl text-xs font-semibold font-ui transition tap-target ${
            activeSubTab === 'notes'
              ? 'bg-[#C2562F] text-white shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          Bookmarks & Notes ({bookNotes.length})
        </button>
      </div>

      {!activeBook ? (
        <div className="p-8 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-3">
          <BookOpen className="w-10 h-10 text-neutral-400 mx-auto" />
          <h3 className="text-base font-serif-heading font-bold text-[var(--text-primary)]">No active book</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto font-reading">
            Load a book or try our demo to unlock bookmarks, 30s recaps, quizzes, and spaced flashcards.
          </p>
          <button
            onClick={onOpenDemo}
            className="px-5 py-2.5 rounded-2xl bg-[#C2562F] hover:bg-[#A94522] text-white font-bold text-xs shadow-md transition"
          >
            Load Demo Book
          </button>
        </div>
      ) : activeSubTab === 'pack' ? (
        <div className="space-y-6">
          {isLoadingPack ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-2">
              <div className="w-6 h-6 border-2 border-[#C2562F] border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Gemini is generating your concept quiz & flashcards...</p>
            </div>
          ) : packError ? (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-xs flex justify-between items-center text-rose-800 dark:text-rose-200">
              <span>{packError}</span>
              <button
                onClick={() => currentSection && loadPack(currentSection)}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold"
              >
                Retry
              </button>
            </div>
          ) : studyPack ? (
            <>
              {/* 30-sec Recap Card */}
              <div className="p-5 rounded-3xl bg-[#FAEDE7] dark:bg-neutral-900 border border-[#C2562F]/30 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C2562F] flex items-center gap-1.5 font-ui">
                  <Sparkles className="w-3.5 h-3.5" /> 30-Second Audio Recap
                </span>
                <p className="text-sm text-[var(--text-primary)] font-reading leading-relaxed">
                  "{studyPack.recap30s}"
                </p>
              </div>

              {/* 3-Question Quiz */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-serif-heading font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-[#C2562F]" />
                    3-Question Concept Quiz
                  </h4>
                  {quizSubmitted && (
                    <span className="text-xs font-bold text-[#C2562F] font-mono">
                      Score:{' '}
                      {
                        Object.entries(quizAnswers).filter(
                          ([idx, ans]) => studyPack.quiz[Number(idx)]?.correctAnswerIndex === ans
                        ).length
                      }{' '}
                      / 3
                    </span>
                  )}
                </div>

                {studyPack.quiz.map((q, qIdx) => (
                  <div
                    key={qIdx}
                    className="p-4 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3"
                  >
                    <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">
                      {qIdx + 1}. {q.question}
                    </p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = quizAnswers[qIdx] === optIdx;
                        const isCorrect = q.correctAnswerIndex === optIdx;

                        let style = 'border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)]';
                        if (quizSubmitted) {
                          if (isCorrect) style = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 font-bold';
                          else if (isSelected) style = 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800';
                        } else if (isSelected) {
                          style = 'border-[#C2562F] bg-[#FAEDE7] text-[#C2562F] font-bold';
                        }

                        return (
                          <button
                            key={optIdx}
                            disabled={quizSubmitted}
                            onClick={() => setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx })}
                            className={`w-full text-left p-3 rounded-2xl border text-xs transition flex items-center justify-between tap-target ${style}`}
                          >
                            <span>{opt}</span>
                            {quizSubmitted && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                            {quizSubmitted && isSelected && !isCorrect && <XCircle className="w-4 h-4 text-rose-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {!quizSubmitted ? (
                  <button
                    onClick={() => setQuizSubmitted(true)}
                    disabled={Object.keys(quizAnswers).length < 3}
                    className="w-full py-3 rounded-2xl bg-[#C2562F] hover:bg-[#A94522] disabled:opacity-40 text-white font-bold text-xs shadow-md transition tap-target"
                  >
                    Submit Quiz
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setQuizSubmitted(false);
                      setQuizAnswers({});
                    }}
                    className="w-full py-2.5 rounded-2xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition flex items-center justify-center gap-1.5"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Retake Quiz
                  </button>
                )}
              </div>

              {/* Flashcards */}
              <div className="space-y-3">
                <h4 className="text-sm font-serif-heading font-bold text-[var(--text-primary)]">
                  Flashcards (Tap to Flip)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {studyPack.flashcards.map((card, cIdx) => {
                    const flipped = flippedCards[cIdx];
                    return (
                      <div
                        key={cIdx}
                        onClick={() => setFlippedCards({ ...flippedCards, [cIdx]: !flipped })}
                        className="p-4 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] min-h-[140px] flex flex-col justify-between cursor-pointer shadow-xs hover:shadow-md transition"
                      >
                        <div>
                          <span className="text-[10px] font-bold uppercase text-[#C2562F]">
                            {flipped ? 'Answer / Concept' : 'Term'}
                          </span>
                          <p className="text-xs sm:text-sm font-bold text-[var(--text-primary)] mt-1 font-reading">
                            {flipped ? card.back : card.front}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                          <span>Tap to flip</span>
                          {flipped && (
                            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleCardSpacedReview(card, 'hard')}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600"
                              >
                                Review Later
                              </button>
                              <button
                                onClick={() => handleCardSpacedReview(card, 'easy')}
                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600"
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
      ) : activeSubTab === 'review' ? (
        /* Review Today */
        <div className="space-y-3">
          {dueCards.length === 0 ? (
            <div className="py-12 text-center text-xs text-[var(--text-muted)] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-[var(--text-primary)]">All caught up today!</p>
              <p>Flashcards you mark for review will reappear here via spaced repetition.</p>
            </div>
          ) : (
            dueCards.map((card) => (
              <div
                key={card.id}
                className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs space-y-1"
              >
                <p className="text-xs font-bold text-[#C2562F]">{card.front}</p>
                <p className="text-xs text-[var(--text-primary)] font-reading">{card.back}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Notes & Bookmarks Tab */
        <div className="space-y-4">
          {/* Action Header: Filter chips + Add Bookmark + Export */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
            {/* Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-ui">
              <button
                onClick={() => setNoteFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-medium transition ${
                  noteFilter === 'all'
                    ? 'bg-[#C2562F] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                All ({bookNotes.length})
              </button>
              <button
                onClick={() => setNoteFilter('bookmarks')}
                className={`px-3 py-1.5 rounded-xl font-medium transition ${
                  noteFilter === 'bookmarks'
                    ? 'bg-[#C2562F] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                Bookmarks ({bookNotes.filter((n) => n.type === 'bookmark').length})
              </button>
              <button
                onClick={() => setNoteFilter('annotated')}
                className={`px-3 py-1.5 rounded-xl font-medium transition ${
                  noteFilter === 'annotated'
                    ? 'bg-[#C2562F] text-white'
                    : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                With Notes ({bookNotes.filter((n) => Boolean(n.userNote)).length})
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                onClick={handleOpenAddModal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAEDE7] text-[#C2562F] hover:bg-[#F3DFD5] border border-[#C2562F]/30 font-semibold text-xs transition"
                title="Save current playback position as bookmark"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bookmark</span>
              </button>

              <button
                onClick={handleExportNotes}
                disabled={bookNotes.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C2562F] hover:bg-[#A94522] disabled:opacity-40 text-white font-semibold text-xs transition shadow-xs"
                title="Export bookmarks as Markdown file"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Bookmarks List */}
          {filteredNotes.length === 0 ? (
            <div className="py-12 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center text-xs text-[var(--text-muted)] space-y-3 p-6">
              <div className="w-12 h-12 rounded-2xl bg-[#FAEDE7] text-[#C2562F] flex items-center justify-center mx-auto">
                <Bookmark className="w-6 h-6" />
              </div>
              <p className="font-bold text-sm text-[var(--text-primary)]">
                {noteFilter === 'all'
                  ? 'No bookmarks saved yet'
                  : `No ${noteFilter} found`}
              </p>
              <p className="max-w-xs mx-auto font-reading text-xs text-[var(--text-secondary)] leading-relaxed">
                Save key timestamps while listening to revisit quotes, formulas, or test concepts.
              </p>
              {activeBook && currentSection && (
                <button
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C2562F] text-white text-xs font-semibold shadow-xs hover:bg-[#A94522] transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Bookmark Current Time ({formatTime(currentTime)})</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotes.map((note) => {
                const timeStr = formatTime(note.timestampSeconds);
                return (
                  <div
                    key={note.id}
                    className="p-4 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3 shadow-xs hover:border-[#C2562F]/40 transition"
                  >
                    {/* Card Top: Section Title, Timestamp, Sentence Index & Date */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-[var(--text-primary)] font-ui">
                          {note.sectionTitle}
                        </span>
                        <button
                          onClick={() => handlePlayBookmark(note)}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-[#FAEDE7] text-[#C2562F] hover:bg-[#F3DFD5] text-[11px] font-mono font-bold transition"
                          title="Click to play from this timestamp"
                        >
                          <Clock className="w-3 h-3" />
                          <span>{timeStr}</span>
                        </button>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono">
                          Sentence #{note.sentenceIndex + 1}
                        </span>
                      </div>

                      <span className="text-[10px] text-[var(--text-muted)]">
                        {new Date(note.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Book Text Excerpt (Quote style with terracotta border) */}
                    <div className="p-3 rounded-2xl bg-[var(--bg-surface-elevated)] border-l-4 border-[#C2562F] text-xs text-[var(--text-primary)] font-reading leading-relaxed">
                      "{note.content}"
                    </div>

                    {/* User Personal Study Note (if present) */}
                    {note.userNote && (
                      <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-xs text-[var(--text-primary)] space-y-1">
                        <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">
                          <Edit3 className="w-3 h-3" />
                          <span>Study Note:</span>
                        </div>
                        <p className="font-reading text-[11px] text-[var(--text-secondary)]">
                          {note.userNote}
                        </p>
                      </div>
                    )}

                    {/* Card Footer: Play from here, Edit Note, Delete */}
                    <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] text-xs">
                      <button
                        onClick={() => handlePlayBookmark(note)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white font-semibold text-xs transition shadow-xs active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Play from {timeStr}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(note)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[#C2562F] hover:bg-[var(--bg-surface-elevated)] transition"
                          title="Edit study note"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                          title="Delete bookmark"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Bookmark Modal */}
      {isAddNoteModalOpen && activeBook && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl shadow-2xl p-5 space-y-4 animate-scale-up">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C2562F] flex items-center gap-1 font-ui">
                  <Bookmark className="w-3.5 h-3.5" />
                  {editingNote ? 'Edit Study Note' : 'Add New Bookmark'}
                </span>
                <h3 className="text-base font-serif-heading font-bold text-[var(--text-primary)] mt-0.5">
                  {activeBook.title}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#FAEDE7] text-[#C2562F]">
                {formatTime(modalTimestamp)}
              </span>
            </div>

            {/* Target Section Picker */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1 font-ui">
                Section:
              </label>
              <select
                value={modalSectionId}
                disabled={Boolean(editingNote)}
                onChange={(e) => {
                  setModalSectionId(e.target.value);
                  setModalSentenceIndex(0);
                }}
                className="w-full p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#C2562F]"
              >
                {activeBook.sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Excerpt Display / Preview */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] font-ui">
                Sentence Excerpt (Sentence #{modalSentenceIndex + 1}):
              </label>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border-l-4 border-[#C2562F] text-xs text-[var(--text-primary)] font-reading max-h-24 overflow-y-auto">
                "{activeBook.sections.find((s) => s.id === modalSectionId)?.sentences[modalSentenceIndex]?.text ||
                  activeBook.sections.find((s) => s.id === modalSectionId)?.title ||
                  'Section start'}"
              </div>
            </div>

            {/* User Note Textarea */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1 font-ui">
                Personal Study Note (Optional):
              </label>
              <textarea
                value={modalUserNote}
                onChange={(e) => setModalUserNote(e.target.value)}
                placeholder="E.g. Important formula for exam, review before quiz..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#C2562F]"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setIsAddNoteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveModalNote}
                className="px-4 py-2 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white text-xs font-bold transition shadow-sm"
              >
                {editingNote ? 'Update Note' : 'Save Bookmark'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
