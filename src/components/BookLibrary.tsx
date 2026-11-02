import React, { useState } from 'react';
import {
  BookOpen,
  Play,
  Trash2,
  DownloadCloud,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  Sparkles,
} from 'lucide-react';
import { ParsedBook, BookProgress } from '../types';
import { deleteBook } from '../services/db';
import { audioPlayer } from '../services/audioPlayer';
import { useToast } from './Toast';

interface BookLibraryProps {
  books: ParsedBook[];
  progressMap: Record<string, BookProgress>;
  activeBookId?: string;
  onSelectBook: (book: ParsedBook, sectionIndex?: number) => void;
  onOpenUpload: () => void;
  onOpenDemo: () => void;
  onRefresh: () => void;
}

export const BookLibrary: React.FC<BookLibraryProps> = ({
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
  const [downloadingBookId, setDownloadingBookId] = useState<string | null>(null);

  const filteredBooks = books.filter(
    (b) =>
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async (e: React.MouseEvent, bookId: string, title: string) => {
    e.stopPropagation();
    if (confirm(`Remove "${title}" from your library?`)) {
      await deleteBook(bookId);
      showToast(`Removed "${title}" from library.`, 'info');
      onRefresh();
    }
  };

  const handleDownloadOffline = async (e: React.MouseEvent, book: ParsedBook) => {
    e.stopPropagation();
    setDownloadingBookId(book.id);
    showToast(`Downloading "${book.title}" audio for offline listening...`, 'info');

    try {
      // Preload first 3 sections into IndexedDB
      const sectionsToCache = book.sections.slice(0, 3);
      for (const section of sectionsToCache) {
        await audioPlayer.preloadNextSection(book, {
          ...section,
          sectionIndex: section.sectionIndex - 1, // trigger preload
        });
      }
      showToast(`Downloaded sections of "${book.title}" to IndexedDB for offline play!`, 'success');
    } catch {
      showToast('Offline download warning: Some sections could not be pre-cached.', 'error');
    } finally {
      setDownloadingBookId(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header bar & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-ui">
            Your Audio Library
          </h2>
          <p className="text-xs text-[var(--text-muted)]">
            {books.length} {books.length === 1 ? 'book' : 'books'} stored locally on this device
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search library..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Upload New Book */}
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Book</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {books.length === 0 ? (
        <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Your Library is Empty</h3>
          <p className="text-xs text-[var(--text-secondary)] mb-6 max-w-sm mx-auto font-reading leading-relaxed">
            Upload your syllabus, research notes, or favorite book to start listening. Or explore with our preloaded interactive demo!
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onOpenDemo}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-xs shadow-md transition hover:opacity-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Load 60-Second Demo Book</span>
            </button>
            <button
              onClick={onOpenUpload}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-[var(--border-subtle)] text-[var(--text-primary)] font-semibold text-xs hover:bg-[var(--bg-surface-elevated)] transition"
            >
              Upload PDF or DOCX
            </button>
          </div>
        </div>
      ) : (
        /* Books Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredBooks.map((book) => {
            const progress = progressMap[book.id];
            const currentSectionIdx = progress?.currentSectionIndex ?? 0;
            const totalSections = book.sections.length || 1;
            const progressPercent = Math.round(((currentSectionIdx + 1) / totalSections) * 100);
            const isActive = activeBookId === book.id;

            return (
              <div
                key={book.id}
                onClick={() => onSelectBook(book, currentSectionIdx)}
                className={`group relative rounded-3xl bg-[var(--bg-surface)] border p-4 shadow-sm hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isActive
                    ? 'border-blue-500 ring-2 ring-blue-500/20'
                    : 'border-[var(--border-subtle)] hover:border-blue-500/40'
                }`}
              >
                {/* Book Card Top: Dynamic Cover + Badges */}
                <div className="flex gap-3 mb-3">
                  {/* Generated Cover */}
                  <div
                    className={`w-20 h-28 rounded-2xl bg-gradient-to-br ${
                      book.coverGradient || 'from-indigo-900 to-slate-900'
                    } p-2 flex flex-col justify-between shadow-md shrink-0 border border-white/10 group-hover:scale-[1.02] transition`}
                  >
                    <BookOpen className="w-4 h-4 text-white/70" />
                    <div>
                      <p className="text-[10px] font-bold text-white line-clamp-3 leading-tight">
                        {book.title}
                      </p>
                      <p className="text-[8px] text-white/60 truncate mt-0.5">{book.author}</p>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="flex-1 flex flex-col justify-between py-0.5">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)] line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {book.title}
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)] line-clamp-1 mt-0.5">
                        {book.author}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
                        <Clock className="w-3 h-3 text-blue-500" />
                        <span>~{book.totalEstimatedMinutes} mins total</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)]">
                        {book.sections.length} commute sections ({book.targetMinutesPerSection || 10}m each)
                      </div>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="pt-2 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)] mb-1">
                    <span>
                      Section {currentSectionIdx + 1}/{totalSections}
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-sky-400 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between mt-3 pt-2 text-xs">
                  <button
                    onClick={(e) => handleDownloadOffline(e, book)}
                    disabled={downloadingBookId === book.id}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-[var(--bg-surface-elevated)] transition"
                    title="Download sections to IndexedDB for offline play"
                  >
                    <DownloadCloud className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => handleDelete(e, book.id, book.title)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      title="Delete book"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <div className="w-7 h-7 rounded-full bg-blue-600 group-hover:bg-blue-700 text-white flex items-center justify-center shadow-md ml-1">
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    </div>
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
