import { create } from 'zustand';
import {
  ParsedBook,
  BookSection,
  PlaybackStatus,
  DEFAULT_VOICE_ID,
  DEFAULT_VOICE_NAME,
} from '../types';
import { audioPlayer } from '../services/audioPlayer';
import { setSetting } from '../services/db';

export type NavTab = 'home' | 'library' | 'ask' | 'study';

interface PlayerState {
  // Navigation & Modals
  currentTab: NavTab;
  isFullScreenPlayerOpen: boolean;
  isCommuteModeOpen: boolean;
  isVoiceModalOpen: boolean;
  isSettingsOpen: boolean;
  isOnboardingOpen: boolean;

  // Book & Playback State
  activeBook: ParsedBook | null;
  currentSection: BookSection | null;
  currentSentenceIndex: number;
  playbackStatus: PlaybackStatus;
  currentTime: number;
  duration: number;
  playbackRate: number;

  // Selected Voice
  selectedVoiceId: string;
  selectedVoiceName: string;

  // Actions
  setCurrentTab: (tab: NavTab) => void;
  setFullScreenPlayerOpen: (open: boolean) => void;
  setCommuteModeOpen: (open: boolean) => void;
  setVoiceModalOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setOnboardingOpen: (open: boolean) => void;

  setActiveBook: (book: ParsedBook | null) => void;
  setCurrentSection: (section: BookSection | null) => void;
  setCurrentSentenceIndex: (index: number) => void;
  setPlaybackStatus: (status: PlaybackStatus) => void;
  setTime: (currentTime: number, duration?: number) => void;
  setPlaybackRate: (rate: number) => void;
  setSelectedVoice: (id: string, name: string) => void;

  // Composite actions
  playBookSection: (book: ParsedBook, section: BookSection, sentenceIndex?: number) => void;
  togglePlayPause: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTab: 'home',
  isFullScreenPlayerOpen: false,
  isCommuteModeOpen: false,
  isVoiceModalOpen: false,
  isSettingsOpen: false,
  isOnboardingOpen: false,

  activeBook: null,
  currentSection: null,
  currentSentenceIndex: 0,
  playbackStatus: 'idle',
  currentTime: 0,
  duration: 0,
  playbackRate: 1.0,

  selectedVoiceId: DEFAULT_VOICE_ID,
  selectedVoiceName: DEFAULT_VOICE_NAME,

  setCurrentTab: (tab) => set({ currentTab: tab }),
  setFullScreenPlayerOpen: (open) => set({ isFullScreenPlayerOpen: open }),
  setCommuteModeOpen: (open) => set({ isCommuteModeOpen: open }),
  setVoiceModalOpen: (open) => set({ isVoiceModalOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setOnboardingOpen: (open) => set({ isOnboardingOpen: open }),

  setActiveBook: (book) => {
    if (book) {
      setSetting('last_active_book_id', book.id);
    }
    set({ activeBook: book });
  },

  setCurrentSection: (section) => set({ currentSection: section }),
  setCurrentSentenceIndex: (index) => set({ currentSentenceIndex: index }),
  setPlaybackStatus: (status) => set({ playbackStatus: status }),

  setTime: (currentTime, duration) =>
    set((state) => ({
      currentTime,
      duration: duration !== undefined && duration > 0 ? duration : state.duration,
    })),

  setPlaybackRate: (rate) => {
    audioPlayer.setPlaybackRate(rate);
    set({ playbackRate: rate });
  },

  setSelectedVoice: (id, name) => {
    audioPlayer.setVoice(id);
    setSetting('selected_voice_id', id);
    setSetting('selected_voice_name', name);
    set({ selectedVoiceId: id, selectedVoiceName: name });
  },

  playBookSection: (book, section, sentenceIndex = 0) => {
    set({
      activeBook: book,
      currentSection: section,
      currentSentenceIndex: sentenceIndex,
      isFullScreenPlayerOpen: true,
    });
    setSetting('last_active_book_id', book.id);
    audioPlayer.playSection(book, section, sentenceIndex, 0);
  },

  togglePlayPause: () => {
    audioPlayer.togglePlayPause();
  },
}));
