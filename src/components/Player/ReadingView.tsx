import React, { useState } from 'react';
import {
  List,
  Type,
  Bookmark,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Maximize2,
  BookOpen,
} from 'lucide-react';
import { ParsedBook, BookSection, SentenceItem } from '../../types';
import { saveNote } from '../../services/db';
import { useToast } from '../Toast';

interface ReadingViewProps {
  book: ParsedBook;
  currentSection: BookSection;
  currentSentenceIndex: number;
  completedSectionIds: string[];
  onSelectSection: (section: BookSection) => void;
  onSentenceClick: (sentenceIndex: number) => void;
  onExplainSnippet: (text: string, style: 'simple' | 'hindi' | 'hinglish') => void;
  onOpenCommuteMode: () => void;
}

export const ReadingView: React.FC<ReadingViewProps> = ({
  book,
  currentSection,
  currentSentenceIndex,
  completedSectionIds,
  onSelectSection,
  onSentenceClick,
  onExplainSnippet,
  onOpenCommuteMode,
}) => {
  const { showToast } = useToast();
  const [showSectionList, setShowSectionList] = useState(false);
  const [fontSizePx, setFontSizePx] = useState(19);
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>('serif');
  const [selectedSentenceForAction, setSelectedSentenceForAction] = useState<SentenceItem | null>(
    null
  );

  const handleBookmark = async (sentence: SentenceItem) => {
    try {
      await saveNote({
        id: `note-${Date.now()}`,
        bookId: book.id,
        sectionId: currentSection.id,
        sectionTitle: currentSection.title,
        timestampSeconds: 0,
        sentenceIndex: currentSentenceIndex,
        type: 'bookmark',
        content: sentence.text,
        createdAt: Date.now(),
      });
      showToast('Bookmarked sentence to Student Notes!', 'success');
      setSelectedSentenceForAction(null);
    } catch {
      showToast('Failed to save bookmark.', 'error');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-36">
      {/* Top Toolbar: Section Selector, Font Controls, Commute Mode */}
      <div className="flex items-center justify-between pb-5 mb-8 border-b border-[var(--border-subtle)] gap-2 flex-wrap">
        {/* Section Picker Button */}
        <div className="relative">
          <button
            onClick={() => setShowSectionList(!showSectionList)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] transition shadow-sm"
          >
            <List className="w-4 h-4 text-blue-500" />
            <span className="truncate max-w-[180px] sm:max-w-xs">{currentSection.title}</span>
            <span className="text-[10px] text-[var(--text-muted)] font-normal">
              ({currentSection.sectionIndex + 1}/{book.sections.length})
            </span>
          </button>

          {/* Section List Dropdown */}
          {showSectionList && (
            <div className="absolute left-0 mt-2 w-80 sm:w-96 max-h-96 overflow-y-auto rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-2 z-50 animate-scale-up">
              <div className="p-2 border-b border-[var(--border-subtle)] mb-1 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Sections & Estimated Time
                </p>
                <span className="text-[10px] text-blue-500 font-semibold">
                  {book.targetMinutesPerSection || 10}m each
                </span>
              </div>
              {book.sections.map((sec) => {
                const isSelected = sec.id === currentSection.id;
                const isCompleted = completedSectionIds.includes(sec.id);
                return (
                  <button
                    key={sec.id}
                    onClick={() => {
                      onSelectSection(sec);
                      setShowSectionList(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20'
                        : 'hover:bg-[var(--bg-surface-elevated)] text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs">{sec.title}</span>
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 font-normal font-reading">
                        {sec.sentences[0]?.text || ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{Math.round(sec.estimatedDurationSeconds / 60)}m</span>
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Font & Display Controls */}
        <div className="flex items-center gap-2">
          {/* Font Family Toggle */}
          <button
            onClick={() => setFontFamily(fontFamily === 'serif' ? 'sans' : 'serif')}
            className="px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition"
            title="Toggle Serif / Sans Font"
          >
            {fontFamily === 'serif' ? 'Serif (Kindle)' : 'Sans (Notion)'}
          </button>

          {/* Font Size A- / A+ */}
          <div className="flex items-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-bold text-[var(--text-secondary)]">
            <button
              onClick={() => setFontSizePx((prev) => Math.max(15, prev - 1))}
              className="px-2 py-1 hover:bg-[var(--bg-surface-elevated)] rounded-l-lg"
              title="Decrease Font Size"
            >
              A-
            </button>
            <span className="px-1 text-[10px] text-[var(--text-muted)]">{fontSizePx}</span>
            <button
              onClick={() => setFontSizePx((prev) => Math.min(26, prev + 1))}
              className="px-2 py-1 hover:bg-[var(--bg-surface-elevated)] rounded-r-lg"
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          {/* Commute Mode Icon */}
          <button
            onClick={onOpenCommuteMode}
            className="p-2 rounded-xl text-neutral-400 hover:text-amber-500 hover:bg-[var(--bg-surface-elevated)] transition border border-[var(--border-subtle)]"
            title="Commute Mode (Large buttons for transit)"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Chapter & Section Heading Banner */}
      <div className="mb-8">
        <p className="text-xs uppercase font-bold tracking-wider text-blue-500 mb-1">
          {currentSection.chapterTitle}
        </p>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-ui tracking-tight mb-2">
          {currentSection.title}
        </h2>
        <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] font-mono">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-blue-500" /> ~
            {Math.round(currentSection.estimatedDurationSeconds / 60)} min read
          </span>
          <span>•</span>
          <span>{currentSection.wordCount} words</span>
          <span>•</span>
          <span className="text-emerald-500 flex items-center gap-1">
            <Headphones className="w-3.5 h-3.5" /> Tap any sentence to listen
          </span>
        </div>
      </div>

      {/* Sentence Action Drawer (Explain Simply / In Hindi / Bookmark) */}
      {selectedSentenceForAction && (
        <div className="sticky top-20 z-30 mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 text-white shadow-xl animate-slide-up flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-wider text-blue-200 font-bold mb-0.5">
              Selected Paragraph:
            </p>
            <p className="text-xs text-white line-clamp-1 italic font-reading">
              "{selectedSentenceForAction.text}"
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                onExplainSnippet(selectedSentenceForAction.text, 'simple');
                setSelectedSentenceForAction(null);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-xs transition flex items-center gap-1"
            >
              <Sparkles className="w-3 h-3 text-amber-300" /> Explain Simply
            </button>
            <button
              onClick={() => {
                onExplainSnippet(selectedSentenceForAction.text, 'hinglish');
                setSelectedSentenceForAction(null);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-xs transition flex items-center gap-1"
            >
              Explain in Hinglish
            </button>
            <button
              onClick={() => handleBookmark(selectedSentenceForAction)}
              className="px-2.5 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold text-xs transition flex items-center gap-1"
            >
              <Bookmark className="w-3 h-3" /> Bookmark
            </button>
            <button
              onClick={() => setSelectedSentenceForAction(null)}
              className="px-2 py-1 text-xs text-blue-200 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Reading Text Container (Synced Karaoke Highlight) */}
      <article
        className={`leading-relaxed text-[var(--text-primary)] transition-all ${
          fontFamily === 'serif' ? 'font-reading' : 'font-ui'
        }`}
        style={{ fontSize: `${fontSizePx}px`, lineHeight: 1.85 }}
      >
        {currentSection.sentences.map((sent, idx) => {
          const isActive = idx === currentSentenceIndex;

          return (
            <span
              key={sent.id}
              id={`sentence-${idx}`}
              onClick={() => onSentenceClick(idx)}
              onContextMenu={(e) => {
                e.preventDefault();
                setSelectedSentenceForAction(sent);
              }}
              className={`inline rounded-lg px-1 py-0.5 transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-amber-300/40 text-[var(--text-primary)] font-medium shadow-sm ring-2 ring-amber-400/40 dark:bg-blue-600/35 dark:ring-blue-500/50'
                  : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60'
              }`}
              title="Click to play from this sentence. Right click or long press for AI explanation."
            >
              {sent.text}{' '}
            </span>
          );
        })}
      </article>

      {/* Section Navigation Footer */}
      <div className="mt-12 pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <button
          onClick={() => {
            if (currentSection.sectionIndex > 0) {
              onSelectSection(book.sections[currentSection.sectionIndex - 1]);
            }
          }}
          disabled={currentSection.sectionIndex === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] disabled:opacity-30 transition"
        >
          <ChevronLeft className="w-4 h-4" /> Previous Section
        </button>

        <span className="text-xs text-[var(--text-muted)] font-mono">
          Section {currentSection.sectionIndex + 1} of {book.sections.length}
        </span>

        <button
          onClick={() => {
            if (currentSection.sectionIndex < book.sections.length - 1) {
              onSelectSection(book.sections[currentSection.sectionIndex + 1]);
            }
          }}
          disabled={currentSection.sectionIndex >= book.sections.length - 1}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] disabled:opacity-30 transition"
        >
          Next Section <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
