import React from 'react';
import { Play, Pause, RotateCw, BookOpen, ChevronUp } from 'lucide-react';
import { ParsedBook, BookSection } from '../../types';
import { audioPlayer, PlaybackStatus } from '../../services/audioPlayer';

interface MiniPlayerProps {
  book: ParsedBook;
  currentSection: BookSection;
  playbackStatus: PlaybackStatus;
  currentTime: number;
  duration: number;
  currentVoiceName?: string;
  onOpenFullScreen: () => void;
}

export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  book,
  currentSection,
  playbackStatus,
  currentTime,
  duration,
  currentVoiceName,
  onOpenFullScreen,
}) => {
  const isPlaying = playbackStatus === 'playing';
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      onClick={onOpenFullScreen}
      className="fixed bottom-16 md:bottom-0 left-0 md:left-64 right-0 z-30 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] cursor-pointer select-none"
      title="Tap to open full player"
    >
      {/* Terracotta progress line */}
      <div className="w-full h-1 bg-[var(--border-subtle)]">
        <div
          className="h-full bg-[#C2562F] transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Book Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-12 rounded-sm bg-[var(--bg-surface-soft)] border border-[var(--border-strong)] flex items-center justify-center shrink-0 text-[#6B5D50]">
            <BookOpen className="w-4 h-4" />
          </div>

          <div className="min-w-0">
            <h4 className="font-serif-heading font-bold text-sm text-[var(--text-primary)] truncate">
              {book.title}
            </h4>
            <p className="text-xs text-[var(--text-secondary)] font-ui truncate flex items-center gap-1.5">
              <span className="truncate">{currentSection.title}</span>
              {currentVoiceName && (
                <>
                  <span className="text-[var(--text-muted)]">•</span>
                  <span className="text-[#C2562F] font-medium shrink-0">{currentVoiceName}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => audioPlayer.seekBy(15)}
            className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)] tap-target flex items-center justify-center"
            title="Forward 15 seconds"
            aria-label="Forward 15 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => audioPlayer.togglePlayPause()}
            disabled={playbackStatus === 'loading'}
            className="w-11 h-11 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white flex items-center justify-center tap-target transition"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {playbackStatus === 'loading' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={onOpenFullScreen}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] tap-target hidden sm:flex items-center justify-center"
            title="Open player"
            aria-label="Open player"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
