import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Mic,
  MicOff,
  X,
  Volume2,
} from 'lucide-react';
import { ParsedBook, BookSection } from '../../types';
import { audioPlayer, PlaybackStatus } from '../../services/audioPlayer';
import { saveNote } from '../../services/db';
import { useToast } from '../Toast';

interface CommuteModeViewProps {
  isOpen: boolean;
  book: ParsedBook;
  currentSection: BookSection;
  playbackStatus: PlaybackStatus;
  playbackRate: number;
  onClose: () => void;
  onOpenAskModal: () => void;
  onRateChange: (rate: number) => void;
}

export const CommuteModeView: React.FC<CommuteModeViewProps> = ({
  isOpen,
  book,
  currentSection,
  playbackStatus,
  playbackRate,
  onClose,
  onOpenAskModal,
  onRateChange,
}) => {
  const { showToast } = useToast();
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const speechRecognizerRef = useRef<any>(null);

  const toggleVoiceCommands = () => {
    if (isVoiceListening) {
      if (speechRecognizerRef.current) speechRecognizerRef.current.stop();
      setIsVoiceListening(false);
      showToast('Voice commands paused.', 'info');
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      showToast('Voice recognition not available. Use on-screen buttons.', 'info');
      return;
    }

    try {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = false;
      recognizer.lang = 'en-US';

      recognizer.onresult = (e: any) => {
        const text = e.results[e.results.length - 1][0].transcript.toLowerCase().trim();
        setLastCommand(text);
        handleVoiceCommand(text);
      };

      recognizer.onerror = () => setIsVoiceListening(false);
      recognizer.start();
      speechRecognizerRef.current = recognizer;
      setIsVoiceListening(true);
      showToast('Listening for commands: "next", "back", "slower", "faster"...', 'success');
    } catch {
      showToast('Microphone access blocked.', 'error');
    }
  };

  const handleVoiceCommand = async (cmd: string) => {
    if (cmd.includes('next') || cmd.includes('aage')) {
      audioPlayer.nextSection();
      showToast('Command: Next Section', 'info');
    } else if (cmd.includes('back') || cmd.includes('rewind') || cmd.includes('piche')) {
      audioPlayer.seekBy(-15);
      showToast('Command: Rewind 15s', 'info');
    } else if (cmd.includes('pause') || cmd.includes('stop') || cmd.includes('ruko')) {
      audioPlayer.pause();
      showToast('Command: Paused', 'info');
    } else if (cmd.includes('play') || cmd.includes('resume') || cmd.includes('chalo')) {
      audioPlayer.play();
      showToast('Command: Resumed', 'info');
    } else if (cmd.includes('faster')) {
      onRateChange(Math.min(2.0, playbackRate + 0.25));
    } else if (cmd.includes('slower')) {
      onRateChange(Math.max(0.75, playbackRate - 0.25));
    } else if (cmd.includes('bookmark')) {
      await saveNote({
        id: `note-${Date.now()}`,
        bookId: book.id,
        sectionId: currentSection.id,
        sectionTitle: currentSection.title,
        timestampSeconds: audioPlayer.getCurrentTime(),
        sentenceIndex: 0,
        type: 'bookmark',
        content: `Commute bookmark at ${Math.round(audioPlayer.getCurrentTime())}s`,
        createdAt: Date.now(),
      });
      showToast('Bookmarked via voice!', 'success');
    } else if (cmd.includes('ask') || cmd.includes('question')) {
      onOpenAskModal();
    }
  };

  if (!isOpen) return null;

  const isPlaying = playbackStatus === 'playing';

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex flex-col justify-between p-6 sm:p-10 select-none animate-fade-in">
      {/* Top Bar: Book Title + Clear "Exit" Button */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 pr-4">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
            Commute Mode
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white truncate mt-1">
            {book.title}
          </h2>
          <p className="text-xs text-neutral-400 truncate">{currentSection.title}</p>
        </div>

        {/* Clear Prominent Exit Button */}
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white font-bold text-sm transition tap-target flex items-center gap-1.5 shrink-0"
        >
          <span>Exit</span>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Center Huge Play / Pause Button */}
      <div className="flex flex-col items-center justify-center my-auto space-y-4">
        {isVoiceListening && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Voice command: {lastCommand ? `"${lastCommand}"` : 'Listening...'}</span>
          </div>
        )}

        <button
          onClick={() => audioPlayer.togglePlayPause()}
          className="w-40 h-40 sm:w-52 sm:h-52 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition active:scale-95"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause className="w-20 h-20 sm:w-24 sm:h-24 fill-current" />
          ) : (
            <Play className="w-20 h-20 sm:w-24 sm:h-24 fill-current ml-2" />
          )}
        </button>

        <p className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
          {isPlaying ? 'Playing • Hands-Free' : 'Paused • Tap to Play'}
        </p>
      </div>

      {/* Bottom 4 Huge Buttons: Back, Next, Voice Cmd, Mic */}
      <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-4 border-t border-neutral-900">
        {/* Huge Back Button (-15s) */}
        <button
          onClick={() => audioPlayer.seekBy(-15)}
          className="py-6 rounded-3xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 flex flex-col items-center justify-center transition active:scale-95 tap-target"
        >
          <RotateCcw className="w-8 h-8 text-white mb-1" />
          <span className="text-xs font-bold text-neutral-300">Back 15s</span>
        </button>

        {/* Huge Next Button (Next Section) */}
        <button
          onClick={() => audioPlayer.nextSection()}
          className="py-6 rounded-3xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 flex flex-col items-center justify-center transition active:scale-95 tap-target"
        >
          <SkipForward className="w-8 h-8 text-white mb-1" />
          <span className="text-xs font-bold text-neutral-300">Next Section</span>
        </button>

        {/* Huge Mic Button (Ask Question) */}
        <button
          onClick={onOpenAskModal}
          className="py-6 rounded-3xl bg-blue-600 hover:bg-blue-700 text-white flex flex-col items-center justify-center transition active:scale-95 shadow-lg shadow-blue-600/30 tap-target"
        >
          <Mic className="w-8 h-8 mb-1" />
          <span className="text-xs font-bold">Ask Book</span>
        </button>
      </div>
    </div>
  );
};
