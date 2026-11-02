import React from 'react';
import { Play, Clock, BookOpen, ChevronRight, CheckCircle2 } from 'lucide-react';
import { ParsedBook, BookProgress } from '../types';

interface ContinueListeningCardProps {
  book: ParsedBook;
  progress: BookProgress;
  onResume: (book: ParsedBook, sectionIndex: number, sentenceIndex: number) => void;
}

export const ContinueListeningCard: React.FC<ContinueListeningCardProps> = ({
  book,
  progress,
  onResume,
}) => {
  const currentSection = book.sections[progress.currentSectionIndex] || book.sections[0];
  const totalSections = book.sections.length;
  const progressRatio = totalSections > 0 ? (progress.currentSectionIndex + 1) / totalSections : 0;
  const progressPercent = Math.round(progressRatio * 100);

  // Remaining minutes estimate
  const remainingSections = totalSections - progress.currentSectionIndex;
  const remainingMinutes = Math.round(remainingSections * (book.targetMinutesPerSection || 10));

  return (
    <div className="w-full max-w-4xl mx-auto px-4 mb-8">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white p-6 sm:p-7 shadow-2xl border border-blue-500/20 group">
        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Left: Book Cover & Details */}
          <div className="flex items-center gap-4">
            {/* Auto-generated cover */}
            <div
              className={`w-16 h-20 sm:w-20 sm:h-26 rounded-2xl bg-gradient-to-br ${
                book.coverGradient || 'from-indigo-600 to-blue-900'
              } p-2.5 flex flex-col justify-between shadow-lg shrink-0 border border-white/10`}
            >
              <BookOpen className="w-4 h-4 text-white/70" />
              <div>
                <p className="text-[10px] font-bold text-white line-clamp-2 leading-tight">
                  {book.title}
                </p>
                <p className="text-[8px] text-white/60 truncate mt-0.5">{book.author}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Continue Listening
                </span>
                <span className="text-xs text-neutral-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> ~{remainingMinutes}m remaining
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold tracking-tight text-white mb-1 line-clamp-1">
                {book.title}
              </h3>

              <p className="text-xs text-blue-200 line-clamp-1 mb-2">
                {currentSection?.title || 'Section 1'}
              </p>

              {/* Progress Bar & Section Indicators */}
              <div className="flex items-center gap-3">
                <div className="w-32 sm:w-48 h-1.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 to-sky-300 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-blue-300">
                  {progressPercent}% (Section {progress.currentSectionIndex + 1} of {totalSections})
                </span>
              </div>
            </div>
          </div>

          {/* Right: Resume Button */}
          <div className="self-end sm:self-center shrink-0">
            <button
              onClick={() =>
                onResume(book, progress.currentSectionIndex, progress.currentSentenceIndex)
              }
              className="flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white text-slate-900 hover:bg-blue-50 font-bold text-sm shadow-xl transition-all duration-200 active:scale-95 group-hover:shadow-blue-500/20"
            >
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
              <span>Resume</span>
              <ChevronRight className="w-4 h-4 text-neutral-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
