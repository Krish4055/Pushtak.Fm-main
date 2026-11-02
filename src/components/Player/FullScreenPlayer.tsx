import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SkipBack,
  SkipForward,
  Moon,
  Mic,
  BookOpen,
  Bookmark,
  List,
  Volume2,
} from 'lucide-react';
import { ParsedBook, BookSection } from '../../types';
import { audioPlayer, PlaybackStatus } from '../../services/audioPlayer';
import { saveNote } from '../../services/db';
import { useToast } from '../Toast';

interface FullScreenPlayerProps {
  isOpen: boolean;
  book: ParsedBook;
  currentSection: BookSection;
  playbackStatus: PlaybackStatus;
  currentTime: number;
  duration: number;
  playbackRate: number;
  currentSentenceIndex: number;
  currentVoiceName?: string;
  onClose: () => void;
  onOpenAsk: () => void;
  onOpenVoiceModal?: () => void;
  onRateChange: (rate: number) => void;
  onSentenceClick: (sentenceIndex: number) => void;
  onSelectSection: (section: BookSection) => void;
}

export const FullScreenPlayer: React.FC<FullScreenPlayerProps> = ({
  isOpen,
  book,
  currentSection,
  playbackStatus,
  currentTime,
  duration,
  playbackRate,
  currentSentenceIndex,
  currentVoiceName,
  onClose,
  onOpenAsk,
  onOpenVoiceModal,
  onRateChange,
  onSentenceClick,
  onSelectSection,
}) => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'player' | 'text'>('player');
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSleepMenu, setShowSleepMenu] = useState(false);
  const [sleepRemaining, setSleepRemaining] = useState<number | null>(null);
  const [showSectionList, setShowSectionList] = useState(false);
  const [isBookmarkModalOpen, setIsBookmarkModalOpen] = useState(false);
  const [bookmarkUserNote, setBookmarkUserNote] = useState('');
  const [bookmarkTimestamp, setBookmarkTimestamp] = useState(0);
  const [bookmarkSentenceIndex, setBookmarkSentenceIndex] = useState(0);

  const speeds = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
  const sleepOptions = [
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '45 min', minutes: 45 },
    { label: '60 min', minutes: 60 },
    { label: 'End of section', minutes: -1 },
  ];

  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setSleepRemaining(audioPlayer.getSleepTimerRemainingSeconds());
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Sync Wake Lock API only when user is reading along in text mode
  useEffect(() => {
    if (isOpen && activeTab === 'text') {
      audioPlayer.setReadingAlong(true);
    } else {
      audioPlayer.setReadingAlong(false);
    }
    return () => {
      audioPlayer.setReadingAlong(false);
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const isPlaying = playbackStatus === 'playing';
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

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

  const openBookmarkDialog = (time: number = currentTime, sentIdx: number = currentSentenceIndex) => {
    setBookmarkTimestamp(time);
    setBookmarkSentenceIndex(sentIdx);
    setBookmarkUserNote('');
    setIsBookmarkModalOpen(true);
  };

  const handleSaveBookmark = async () => {
    const sentence = currentSection.sentences[bookmarkSentenceIndex] || {
      text: currentSection.title,
      wordCount: 0,
      startWordIndex: 0,
      id: `sent-${bookmarkSentenceIndex}`,
    };

    await saveNote({
      id: `note-${Date.now()}`,
      bookId: book.id,
      sectionId: currentSection.id,
      sectionTitle: currentSection.title,
      timestampSeconds: Math.round(bookmarkTimestamp),
      sentenceIndex: bookmarkSentenceIndex,
      type: 'bookmark',
      content: sentence.text,
      userNote: bookmarkUserNote.trim() || undefined,
      createdAt: Date.now(),
    });

    setIsBookmarkModalOpen(false);
    setBookmarkUserNote('');
    showToast(`Saved bookmark at ${formatTime(bookmarkTimestamp)} to Study notes.`, 'success');
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-app)] flex flex-col justify-between overflow-hidden">
      {/* Top Bar: Close, Tabs, Section List */}
      <div className="px-4 sm:px-6 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between shrink-0">
        <button
          onClick={onClose}
          className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)] tap-target flex items-center gap-1"
          aria-label="Close player"
        >
          <ChevronDown className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline font-ui">Close</span>
        </button>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface-soft)] border border-[var(--border-subtle)]">
          <button
            onClick={() => setActiveTab('player')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'player'
                ? 'bg-[var(--bg-surface)] text-[#C2562F] font-semibold border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Player
          </button>
          <button
            onClick={() => setActiveTab('text')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === 'text'
                ? 'bg-[var(--bg-surface)] text-[#C2562F] font-semibold border border-[var(--border-subtle)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Reading text
          </button>
        </div>

        {/* Section List Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSectionList(!showSectionList)}
            className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)] tap-target flex items-center justify-center"
            title="Sections"
            aria-label="Sections"
          >
            <List className="w-5 h-5" />
          </button>

          {showSectionList && (
            <div className="absolute right-0 mt-2 w-72 max-h-80 overflow-y-auto rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-md p-2 z-50">
              <p className="px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] border-b border-[var(--border-subtle)] mb-1">
                Sections ({book.sections.length})
              </p>
              {book.sections.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => {
                    onSelectSection(sec);
                    setShowSectionList(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-lg text-sm transition truncate ${
                    sec.id === currentSection.id
                      ? 'bg-[#FAEDE7] text-[#C2562F] font-semibold'
                      : 'hover:bg-[var(--bg-surface-soft)] text-[var(--text-primary)]'
                  }`}
                >
                  {sec.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content View */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 max-w-lg mx-auto w-full flex flex-col justify-center">
        {activeTab === 'player' ? (
          /* TAB 1: PLAYER & COVER */
          <div className="w-full flex flex-col items-center text-center space-y-6 my-auto">
            {/* Paper Book Cover */}
            <div className="w-48 h-64 sm:w-56 sm:h-72 rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--border-strong)] p-6 flex flex-col justify-between shadow-xs shrink-0 text-left">
              <span className="font-serif-heading font-bold text-xs uppercase tracking-wider text-[#C2562F]">
                Pushtak
              </span>
              <div>
                <h3 className="font-serif-heading font-bold text-xl text-[var(--text-primary)] line-clamp-3 leading-snug">
                  {book.title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] font-ui mt-1.5 truncate">
                  {book.author}
                </p>
              </div>
            </div>

            {/* Title & Section */}
            <div className="max-w-md">
              <span className="text-xs font-semibold uppercase text-[#C2562F] tracking-wider">
                {currentSection.chapterTitle || 'Chapter Section'}
              </span>
              <h2 className="font-serif-heading font-bold text-xl sm:text-2xl text-[var(--text-primary)] mt-1 line-clamp-2">
                {currentSection.title}
              </h2>

              {/* Narrator Voice Badge */}
              {onOpenVoiceModal && (
                <button
                  onClick={onOpenVoiceModal}
                  className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#C2562F] transition tap-target"
                  title="Change narrator voice"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#C2562F]" />
                  <span>
                    Voice: <strong className="text-[var(--text-primary)] font-semibold">{currentVoiceName || 'Lakshmi'}</strong>
                  </span>
                </button>
              )}
            </div>

            {/* Scrubber */}
            <div className="w-full space-y-1.5">
              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={progressPercent || 0}
                onChange={handleScrubberChange}
                className="w-full h-2 bg-[var(--border-subtle)] rounded-lg appearance-none cursor-pointer accent-[#C2562F]"
              />
              <div className="flex items-center justify-between text-xs font-mono text-[var(--text-secondary)]">
                <span>{formatTime(currentTime)}</span>
                <button
                  onClick={() => openBookmarkDialog(currentTime, currentSentenceIndex)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-ui font-semibold text-[#C2562F] hover:bg-[#FAEDE7] border border-[#C2562F]/30 transition tap-target"
                  title="Bookmark current timestamp"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Bookmark ({formatTime(currentTime)})</span>
                </button>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls (Big terracotta play button) */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 pt-2">
              <button
                onClick={() => audioPlayer.previousSection()}
                className="p-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] tap-target flex items-center justify-center"
                title="Previous section"
                aria-label="Previous section"
              >
                <SkipBack className="w-5 h-5" />
              </button>

              <button
                onClick={() => audioPlayer.seekBy(-15)}
                className="p-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] tap-target flex items-center justify-center relative"
                title="Rewind 15s"
                aria-label="Rewind 15s"
              >
                <RotateCcw className="w-6 h-6" />
                <span className="text-[9px] font-bold absolute text-[var(--text-secondary)]">15</span>
              </button>

              {/* Big Terracotta Play Button */}
              <button
                onClick={() => audioPlayer.togglePlayPause()}
                disabled={playbackStatus === 'loading'}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#C2562F] hover:bg-[#A94522] text-white flex items-center justify-center active:scale-95 transition"
                title={isPlaying ? 'Pause' : 'Play'}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {playbackStatus === 'loading' ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-8 h-8 fill-current" />
                ) : (
                  <Play className="w-8 h-8 fill-current ml-1" />
                )}
              </button>

              <button
                onClick={() => audioPlayer.seekBy(15)}
                className="p-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] tap-target flex items-center justify-center relative"
                title="Forward 15s"
                aria-label="Forward 15s"
              >
                <RotateCw className="w-6 h-6" />
                <span className="text-[9px] font-bold absolute text-[var(--text-secondary)]">15</span>
              </button>

              <button
                onClick={() => audioPlayer.nextSection()}
                className="p-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] tap-target flex items-center justify-center"
                title="Next section"
                aria-label="Next section"
              >
                <SkipForward className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          /* TAB 2: SYNCED READING TEXT */
          <div className="w-full space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] text-sm">
              <span className="font-ui text-xs text-[var(--text-secondary)]">
                Tap any sentence to play from there
              </span>
              <button
                onClick={() => openBookmarkDialog(currentTime, currentSentenceIndex)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold text-[#C2562F] hover:bg-[#FAEDE7] border border-[#C2562F]/30 transition"
              >
                <Bookmark className="w-3.5 h-3.5" />
                <span>Bookmark sentence</span>
              </button>
            </div>

            <article className="font-reading text-[var(--text-primary)] leading-relaxed">
              {currentSection.sentences.map((sent, idx) => {
                const isActive = idx === currentSentenceIndex;
                return (
                  <span
                    key={sent.id}
                    id={`sentence-${idx}`}
                    onClick={() => onSentenceClick(idx)}
                    className={`inline rounded px-1 py-0.5 cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-[#EAD0A5] text-[var(--text-primary)] font-medium'
                        : 'hover:bg-[var(--bg-surface-soft)]'
                    }`}
                  >
                    {sent.text}{' '}
                  </span>
                );
              })}
            </article>
          </div>
        )}
      </div>

      {/* Bottom Bar: Speed, Sleep, and Clear "Ask a question" Button */}
      <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          {/* Speed Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-mono font-medium text-[var(--text-primary)] tap-target flex items-center justify-center"
              title="Speed"
            >
              {playbackRate}x
            </button>

            {showSpeedMenu && (
              <div className="absolute left-0 bottom-14 w-28 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-md p-1.5 z-50">
                {speeds.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      onRateChange(s);
                      setShowSpeedMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-mono rounded-lg ${
                      playbackRate === s
                        ? 'font-bold text-[#C2562F] bg-[#FAEDE7]'
                        : 'text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)]'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sleep Timer */}
          <div className="relative">
            <button
              onClick={() => setShowSleepMenu(!showSleepMenu)}
              className={`p-2.5 rounded-xl border border-[var(--border-subtle)] tap-target flex items-center justify-center ${
                sleepRemaining !== null
                  ? 'text-[#C2562F] bg-[#FAEDE7] border-[#C2562F]'
                  : 'text-[var(--text-secondary)]'
              }`}
              title="Sleep Timer"
            >
              <Moon className="w-5 h-5" />
            </button>

            {showSleepMenu && (
              <div className="absolute left-0 bottom-14 w-36 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-md p-1.5 z-50">
                {sleepOptions.map((opt) => (
                  <button
                    key={opt.minutes}
                    onClick={() => {
                      audioPlayer.setSleepTimer(opt.minutes);
                      setShowSleepMenu(false);
                      showToast(`Sleep timer: ${opt.label}`, 'info');
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)] rounded-lg"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Labelled Voice Button */}
          {onOpenVoiceModal && (
            <button
              onClick={onOpenVoiceModal}
              className="px-3 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)] tap-target flex items-center gap-1.5 shrink-0"
              title="Choose narrator voice"
            >
              <Volume2 className="w-4 h-4 text-[#C2562F]" />
              <span className="font-ui">Voice: {currentVoiceName || 'Lakshmi'}</span>
            </button>
          )}

          {/* Clearly Labelled "Ask a question" Button */}
          <button
            onClick={() => {
              onClose();
              onOpenAsk();
            }}
            className="flex-1 py-3 px-5 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white font-medium text-sm transition flex items-center justify-center gap-2 tap-target"
          >
            <Mic className="w-4 h-4" />
            <span>Ask a question</span>
          </button>
        </div>
      </div>

      {/* Save Bookmark Modal */}
      {isBookmarkModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#C2562F] flex items-center gap-1 font-ui">
                  <Bookmark className="w-3.5 h-3.5" /> Save Bookmark
                </span>
                <h3 className="text-base font-serif-heading font-bold text-[var(--text-primary)] mt-0.5">
                  {currentSection.title}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-[#FAEDE7] text-[#C2562F]">
                {formatTime(bookmarkTimestamp)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-[var(--bg-surface-soft)] border-l-4 border-[#C2562F] text-xs text-[var(--text-primary)] font-reading max-h-24 overflow-y-auto">
              "{currentSection.sentences[bookmarkSentenceIndex]?.text || currentSection.title}"
            </div>

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1 font-ui">
                Personal Study Note (Optional):
              </label>
              <textarea
                value={bookmarkUserNote}
                onChange={(e) => setBookmarkUserNote(e.target.value)}
                placeholder="E.g. Important formula for exam, review before quiz..."
                rows={3}
                className="w-full p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[#C2562F]"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                onClick={() => setIsBookmarkModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBookmark}
                className="px-4 py-2 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white text-xs font-bold transition shadow-sm"
              >
                Save to Study Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
