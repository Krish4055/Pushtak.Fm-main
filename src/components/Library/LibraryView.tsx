import React, { useState } from 'react';
import {
  BookOpen,
  Play,
  MoreVertical,
  Trash2,
  DownloadCloud,
  Clock,
  Search,
  Plus,
  Sparkles,
} from 'lucide-react';
import { ParsedBook, BookProgress } from '../../types';
import { deleteBook } from '../../services/db';
import { audioPlayer } from '../../services/audioPlayer';
import { useToast } from '../Toast';

interface LibraryViewProps {
  books: ParsedBook[];
  progressMap: Record<string, BookProgress>;
  activeBookId?: string;
  onSelectBook: (book: ParsedBook, sectionIndex?: number) => void;
  onOpenUpload: () => void;
  onOpenDemo: () => void;
  onRefresh: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  books,
  progressMap,
  activeBookId,
  onSelectBook,
  onOpenUpload,
  onOpenDemo,
  onRefresh,
}) => {
  const { showToast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [openMenuBookId, setOpenMenuBookId] = useState<string | null>(null);

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (e: React.MouseEvent, bookId: string, title: string) => {
    e.stopPropagation();
    setOpenMenuBookId(null);
    if (confirm(`Remove "${title}" from your library?`)) {
      await deleteBook(bookId);
      showToast(`Removed "${title}".`, 'info');
      onRefresh();
    }
  };

  const handleDownloadOffline = async (e: React.MouseEvent, book: ParsedBook) => {
    e.stopPropagation();
    setOpenMenuBookId(null);
    showToast(`Caching audio of "${book.title}" in IndexedDB for offline play...`, 'info');

    try {
      const sectionsToCache = book.sections.slice(0, 3);
      for (const section of sectionsToCache) {
        await audioPlayer.preloadNextSection(book, {
          ...section,
          sectionIndex: section.sectionIndex - 1,
        });
      }
      showToast(`Sections of "${book.title}" saved offline!`, 'success');
    } catch {
      showToast('Could not cache some sections.', 'error');
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      {/* Title & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)] font-ui tracking-tight">
            Your Library
          </h2>
          <p className="text-xs text-[var(--text-secondary)] font-reading">
            {books.length} {books.length === 1 ? 'book' : 'books'} stored locally on this device
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search books..."
              className="w-full pl-9 pr-3 py-2.5 rounded-2xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500/30 tap-target"
            />
          </div>

          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition tap-target shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Book</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {books.length === 0 ? (
        <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-10 text-center max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Your library is empty</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1 font-reading leading-relaxed">
              Upload a book, syllabus, or research notes to listen anywhere hands-free.
            </p>
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={onOpenUpload}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition tap-target"
            >
              Upload PDF or Notes
            </button>
            <button
              onClick={onOpenDemo}
              className="w-full py-2.5 rounded-2xl border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition"
            >
              Try Preloaded Demo Book
            </button>
          </div>
        </div>
      ) : (
        /* Books Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBooks.map((book) => {
            const progress = progressMap[book.id];
            const currentSectionIdx = progress?.currentSectionIndex ?? 0;
            const totalSections = book.sections.length || 1;
            const progressPercent = Math.round(((currentSectionIdx + 1) / totalSections) * 100);
            const remainingMinutes = (totalSections - currentSectionIdx) * (book.targetMinutesPerSection || 10);
            const isActive = activeBookId === book.id;

            return (
              <div
                key={book.id}
                onClick={() => onSelectBook(book, currentSectionIdx)}
                className={`relative rounded-3xl bg-[var(--bg-surface)] border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'border-blue-600 ring-2 ring-blue-600/20'
                    : 'border-[var(--border-subtle)] hover:border-blue-400'
                }`}
              >
                {/* Book Header & 3-Dots Menu */}
                <div className="flex items-start gap-3.5 mb-3">
                  {/* Generated Cover */}
                  <div
                    className={`w-14 h-20 rounded-2xl bg-gradient-to-br ${
                      book.coverGradient || 'from-indigo-800 to-blue-900'
                    } p-2 flex flex-col justify-between shrink-0 shadow-sm border border-white/10`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-white/70" />
                    <p className="text-[9px] font-bold text-white line-clamp-2 leading-tight">
                      {book.title}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-sm font-bold text-[var(--text-primary)] line-clamp-2 leading-snug">
                        {book.title}
                      </h4>

                      {/* 3-dots Menu Button */}
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() =>
                            setOpenMenuBookId(openMenuBookId === book.id ? null : book.id)
                          }
                          className="p-1 rounded-lg text-neutral-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {openMenuBookId === book.id && (
                          <div className="absolute right-0 mt-1 w-44 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl p-1.5 z-50 animate-scale-up">
                            <button
                              onClick={(e) => handleDownloadOffline(e, book)}
                              className="w-full text-left p-2 rounded-xl text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2"
                            >
                              <DownloadCloud className="w-3.5 h-3.5 text-blue-500" />
                              <span>Download for offline</span>
                            </button>
                            <button
                              onClick={(e) => handleDelete(e, book.id, book.title)}
                              className="w-full text-left p-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete book</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">{book.author}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-2 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-blue-500" /> ~{remainingMinutes}m remaining
                    </p>
                  </div>
                </div>

                {/* Progress Bar & Played Indicator */}
                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs">
                  <div className="flex-1 mr-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                      <span>Section {currentSectionIdx + 1}/{totalSections}</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
