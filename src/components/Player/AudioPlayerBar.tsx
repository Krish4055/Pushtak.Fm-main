import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Moon,
  Mic,
  Maximize2,
  Gauge,
  Sparkles,
  Volume2,
  VolumeX,
  Bookmark,
} from 'lucide-react';
import { ParsedBook, BookSection } from '../../types';
import { audioPlayer, PlaybackStatus } from '../../services/audioPlayer';
import { saveNote } from '../../services/db';
import { useToast } from '../Toast';

interface AudioPlayerBarProps {
  book: ParsedBook;
  currentSection: BookSection;
  playbackStatus: PlaybackStatus;
  currentTime: number;
  duration: number;
  playbackRate: number;
  activeEngine: string;
  onOpenAskModal: () => void;
  onOpenCommuteMode: () => void;
  onRateChange: (rate: number) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  book,
  currentSection,
  playbackStatus,
  currentTime,
  duration,
  playbackRate,
  activeEngine,
  onOpenAskModal,
  onOpenCommuteMode,
  onRateChange,
}) => {
  const { showToast } = useToast();
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const speeds = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const sleepOptions = [
    { label: '15 minutes', minutes: 15 },
    { label: '30 minutes', minutes: 30 },
    { label: '45 minutes', minutes: 45 },
    { label: '60 minutes', minutes: 60 },
    { label: 'End of section', minutes: -1 },
  ];

  // Poll sleep timer status
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = audioPlayer.getSleepTimerRemainingSeconds();
      setSleepRemaining(remaining);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Equalizer Waveform Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const isPlaying = playbackStatus === 'playing';
      const numBars = 16;
      const barWidth = 3;
      const gap = 3;
      const totalWidth = numBars * (barWidth + gap);
      const startX = (width - totalWidth) / 2;

      for (let i = 0; i < numBars; i++) {
        let barHeight = 4;
        if (isPlaying) {
          // Dynamic frequency oscillation
          const time = Date.now() / 200;
          barHeight = Math.max(
            4,
            Math.sin(time + i * 0.5) * 10 + Math.cos(time * 0.7 + i * 0.3) * 6 + 12
          );
        }
        const x = startX + i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = isPlaying ? '#3b82f6' : '#94a3b8';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }
    };

    render();
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [playbackStatus]);

  // Format seconds to mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    audioPlayer.seekToRatio(val / 100);
  };

  const handleSetSleepTimer = (minutes: number) => {
    audioPlayer.setSleepTimer(minutes);
    setShowSleepMenu(false);
    if (minutes === -1) {
      showToast('Sleep timer set to pause at end of this section', 'info');
    } else {
      showToast(`Sleep timer set for ${minutes} minutes with smooth fade out`, 'info');
    }
  };

  const handleCancelSleepTimer = () => {
    audioPlayer.cancelSleepTimer();
    setSleepRemaining(null);
    setShowSleepMenu(false);
    showToast('Sleep timer cancelled', 'info');
  };

  const handleBookmarkCurrent = async () => {
    const sentIdx = audioPlayer.getCurrentSentenceIndex();
    const sentence = currentSection.sentences[sentIdx] || { text: currentSection.title };
    await saveNote({
      id: `note-${Date.now()}`,
      bookId: book.id,
      sectionId: currentSection.id,
      sectionTitle: currentSection.title,
      timestampSeconds: Math.round(currentTime),
      sentenceIndex: sentIdx,
      type: 'bookmark',
      content: sentence.text,
      createdAt: Date.now(),
    });
    showToast(`Saved bookmark at ${formatTime(currentTime)} to Study notes`, 'success');
  };

  const currentProgressRatio = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)]/95 backdrop-blur-xl border-t border-[var(--border-subtle)] shadow-2xl transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        {/* Progress Scrubber (Full width across top) */}
        <div className="relative group mb-2">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={currentProgressRatio || 0}
            onChange={handleScrubberChange}
            className="w-full h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-600 transition-all hover:h-2"
          />
          <div className="flex justify-between text-[10px] font-mono text-[var(--text-muted)] mt-1">
            <span>{formatTime(currentTime)}</span>
            <span className="flex items-center gap-1.5 font-semibold text-[11px] text-blue-500">
              <span className="truncate max-w-[200px] sm:max-w-md">{currentSection.title}</span>
            </span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Player Controls Grid */}
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Book & Engine Info + Equalizer */}
          <div className="flex items-center gap-3 min-w-0 flex-1 sm:flex-initial sm:w-64">
            <canvas
              ref={canvasRef}
              width={100}
              height={28}
              className="hidden sm:block shrink-0 rounded-lg bg-[var(--bg-surface-elevated)]"
              title="Acoustic Equalizer"
            />
            <div className="truncate">
              <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                {book.title}
              </h4>
              <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)]">
                <span className="truncate">{activeEngine}</span>
              </div>
            </div>
          </div>

          {/* Center: Playback Controls (+/-15s, Play/Pause, Next/Prev) */}
          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* Previous Section */}
            <button
              onClick={() => audioPlayer.previousSection()}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition"
              title="Previous Section"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            {/* Rewind 15s */}
            <button
              onClick={() => audioPlayer.seekBy(-15)}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition flex items-center justify-center relative group"
              title="Rewind 15 seconds (Left Arrow)"
            >
              <RotateCcw className="w-4 h-4" />
              <span className="text-[8px] font-bold absolute text-[var(--text-muted)]">15</span>
            </button>

            {/* Play / Pause Primary Button */}
            <button
              onClick={() => audioPlayer.togglePlayPause()}
              disabled={playbackStatus === 'loading'}
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 transition active:scale-95 disabled:opacity-50"
              title="Play / Pause (Spacebar)"
            >
              {playbackStatus === 'loading' ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : playbackStatus === 'playing' ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </button>

            {/* Forward 15s */}
            <button
              onClick={() => audioPlayer.seekBy(15)}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition flex items-center justify-center relative group"
              title="Forward 15 seconds (Right Arrow)"
            >
              <RotateCw className="w-4 h-4" />
              <span className="text-[8px] font-bold absolute text-[var(--text-muted)]">15</span>
            </button>

            {/* Next Section */}
            <button
              onClick={() => audioPlayer.nextSection()}
              className="p-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition"
              title="Next Section"
            >
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Right Tools: Speed, Sleep, Ask the Book, Commute Mode */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Speed Selector */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2.5 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-xs font-mono font-bold text-[var(--text-secondary)] transition"
                title="Playback Speed (0.75x - 2.0x)"
              >
                {playbackRate}x
              </button>

              {showSpeedMenu && (
                <div className="absolute right-0 bottom-12 w-32 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl py-2 z-50">
                  <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Playback Speed
                  </p>
                  {speeds.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        onRateChange(s);
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center justify-between hover:bg-[var(--bg-surface-elevated)] transition ${
                        playbackRate === s
                          ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                          : 'text-[var(--text-primary)]'
                      }`}
                    >
                      <span>{s}x</span>
                      {playbackRate === s && <span className="text-[10px]">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sleep Timer */}
            <div className="relative">
              <button
                onClick={() => setShowSleepMenu(!showSleepMenu)}
                className={`p-2 rounded-xl border border-[var(--border-subtle)] transition relative ${
                  sleepRemaining !== null
                    ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/30 font-bold'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
                title="Sleep Timer (15, 30, 45, 60m or End of Section)"
              >
                <Moon className="w-4 h-4" />
                {sleepRemaining !== null && sleepRemaining > 0 && (
                  <span className="absolute -top-1 -right-1 px-1 rounded-full text-[9px] font-bold bg-indigo-600 text-white">
                    {Math.ceil(sleepRemaining / 60)}m
                  </span>
                )}
              </button>

              {showSleepMenu && (
                <div className="absolute right-0 bottom-12 w-48 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl py-2 z-50">
                  <div className="px-3 py-1 border-b border-[var(--border-subtle)] mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Sleep Timer
                    </span>
                    {sleepRemaining !== null && (
                      <button
                        onClick={handleCancelSleepTimer}
                        className="text-[10px] text-rose-500 font-bold hover:underline"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                  {sleepOptions.map((opt) => (
                    <button
                      key={opt.minutes}
                      onClick={() => handleSetSleepTimer(opt.minutes)}
                      className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] transition flex items-center justify-between"
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Bookmark Current Time Button */}
            <button
              onClick={handleBookmarkCurrent}
              className="p-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[#C2562F] hover:bg-[#FAEDE7] transition"
              title={`Bookmark at ${formatTime(currentTime)}`}
              aria-label="Bookmark current time"
            >
              <Bookmark className="w-4 h-4" />
            </button>

            {/* Ask the Book Voice Mic Button */}
            <button
              onClick={onOpenAskModal}
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition active:scale-95"
              title="Ask the Book (Prisma STT + Answers by Gemini)"
            >
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ask</span>
            </button>

            {/* Commute Mode Fullscreen Button */}
            <button
              onClick={onOpenCommuteMode}
              className="p-2 rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] transition hidden md:block"
              title="Open Commute Mode"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
