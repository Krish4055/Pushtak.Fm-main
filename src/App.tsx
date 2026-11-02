/**
 * Pushtak.fm — Main Application
 * 
 * Clean, mobile-first redesign.
 * Navigation: 4 tabs (Home, Library, Ask, Study)
 * Slim Mini-player above bottom bar (only when loaded), never covering content.
 * Header: Logo on left, single Settings button on right.
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Navigation, NavTab } from './components/Navigation';
import { HomeView } from './components/Home/HomeView';
import { LibraryView } from './components/Library/LibraryView';
import { AskBookView } from './components/AskBook/AskBookView';
import { StudentView } from './components/StudentMode/StudentView';
import { MiniPlayer } from './components/Player/MiniPlayer';
import { FullScreenPlayer } from './components/Player/FullScreenPlayer';
import { CommuteModeView } from './components/CommuteMode/CommuteModeView';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { VoiceSelectionModal } from './components/Voice/VoiceSelectionModal';
import { ToastProvider, useToast } from './components/Toast';
import { OfflineIndicator } from './components/OfflineIndicator';

import {
  ParsedBook,
  BookSection,
  BookProgress,
  ThemeMode,
  DEFAULT_VOICE_ID,
  DEFAULT_VOICE_NAME,
  VoiceDefinition,
} from './types';
import {
  getAllBooks,
  getAllProgress,
  saveBook,
  getSetting,
  setSetting,
} from './services/db';
import { audioPlayer, PlaybackStatus } from './services/audioPlayer';

function PushtakApp() {
  const { showToast } = useToast();

  // Navigation State
  const [currentTab, setCurrentTab] = useState<NavTab>('home');

  // App Settings & Theming (Default: Light & Warm)
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [language, setLanguage] = useState<string>('en');

  // Books & Playback State
  const [books, setBooks] = useState<ParsedBook[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, BookProgress>>({});
  const [activeBook, setActiveBook] = useState<ParsedBook | null>(null);
  const [currentSection, setCurrentSection] = useState<BookSection | null>(null);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState<number>(0);

  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus>('idle');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackRate, setPlaybackRate] = useState<number>(1.0);

  // Modals & Overlays
  const [isFullScreenPlayerOpen, setIsFullScreenPlayerOpen] = useState(false);
  const [isCommuteModeOpen, setIsCommuteModeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Selected Narrator Voice
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(DEFAULT_VOICE_ID);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>(DEFAULT_VOICE_NAME);

  // Apply Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    setSetting('theme', theme);
  }, [theme]);

  // Load Saved State & Initial Demo Book
  useEffect(() => {
    loadInitialData();
    setupAudioListeners();
  }, []);

  const loadInitialData = async () => {
    try {
      // Default to 'light' theme
      const savedTheme = await getSetting<ThemeMode>('theme', 'light');
      setTheme(savedTheme);

      // Restore saved narrator voice (migrating legacy IDs to verified timbre-v3.0 voice)
      const validVoiceNames = ['Lakshmi', 'Vasudha', 'Shivani', 'Yashraj', 'Prakash', 'Avinash'];
      let savedVoiceId = await getSetting<string>('selected_voice_id', DEFAULT_VOICE_ID);
      let savedVoiceName = await getSetting<string>('selected_voice_name', DEFAULT_VOICE_NAME);

      if (!validVoiceNames.includes(savedVoiceId)) {
        savedVoiceId = DEFAULT_VOICE_ID;
        savedVoiceName = DEFAULT_VOICE_NAME;
        await setSetting('selected_voice_id', DEFAULT_VOICE_ID);
        await setSetting('selected_voice_name', DEFAULT_VOICE_NAME);
      }

      setSelectedVoiceId(savedVoiceId);
      setSelectedVoiceName(savedVoiceName);
      audioPlayer.setVoice(savedVoiceId);

      const hasSeenOnboarding = await getSetting<boolean>('has_seen_onboarding', false);
      if (!hasSeenOnboarding) {
        setIsOnboardingOpen(true);
        setSetting('has_seen_onboarding', true);
      }

      let allBooks = await getAllBooks();
      const allProg = await getAllProgress();
      const pMap: Record<string, BookProgress> = {};
      allProg.forEach((p) => {
        pMap[p.bookId] = p;
      });
      setProgressMap(pMap);

      // Preload demo book if library is empty
      if (allBooks.length === 0) {
        const resp = await fetch('/api/demo-book?targetMinutes=5');
        if (resp.ok) {
          const demoBook: ParsedBook = await resp.json();
          await saveBook(demoBook);
          allBooks = [demoBook];
        }
      }

      setBooks(allBooks);

      // Restore last active book
      if (allBooks.length > 0) {
        const lastBookId = await getSetting<string | null>('last_active_book_id', null);
        const targetBook = allBooks.find((b) => b.id === lastBookId) || allBooks[0];
        const lastProg = pMap[targetBook.id];
        const secIdx = lastProg?.currentSectionIndex ?? 0;
        const sentIdx = lastProg?.currentSentenceIndex ?? 0;

        setActiveBook(targetBook);
        setCurrentSection(targetBook.sections[secIdx] || targetBook.sections[0]);
        setCurrentSentenceIndex(sentIdx);
      }
    } catch (err) {
      console.warn('[Pushtak] Initialization error:', err);
    }
  };

  const setupAudioListeners = () => {
    audioPlayer.setEvents({
      onStatusChange: (status) => setPlaybackStatus(status),
      onTimeUpdate: (cur, dur) => {
        setCurrentTime(cur);
        setDuration(dur);
      },
      onSentenceChange: (sentIdx) => {
        setCurrentSentenceIndex(sentIdx);
      },
      onSectionComplete: (sec) => {
        showToast(`Completed "${sec.title}". Starting next section...`, 'success');
      },
      onError: (msg) => showToast(msg, 'error'),
    });
  };

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.code === 'Space') {
        e.preventDefault();
        audioPlayer.togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        audioPlayer.seekBy(-15);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        audioPlayer.seekBy(15);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Book Loaded from Upload
  const handleBookLoaded = (newBook: ParsedBook) => {
    setBooks((prev) => [newBook, ...prev.filter((b) => b.id !== newBook.id)]);
    setActiveBook(newBook);
    const firstSec = newBook.sections[0];
    setCurrentSection(firstSec);
    setCurrentSentenceIndex(0);
    setSetting('last_active_book_id', newBook.id);

    // Play immediately and open full-screen player
    audioPlayer.playSection(newBook, firstSec, 0, 0);
    setIsFullScreenPlayerOpen(true);
  };

  // Handle Select Book from Library or Continue Card
  const handleSelectBook = (book: ParsedBook, sectionIndex = 0, sentenceIndex = 0) => {
    setActiveBook(book);
    const sec = book.sections[sectionIndex] || book.sections[0];
    setCurrentSection(sec);
    setCurrentSentenceIndex(sentenceIndex);
    setSetting('last_active_book_id', book.id);

    audioPlayer.playSection(book, sec, sentenceIndex, 0);
    setIsFullScreenPlayerOpen(true);
  };

  // Demo Book 1-Tap Trigger
  const handleRunDemo = async () => {
    showToast('Loading preloaded demo book...', 'info');
    let demo = books.find((b) => b.id === 'demo-deep-focus');
    if (!demo) {
      const resp = await fetch('/api/demo-book?targetMinutes=5');
      demo = await resp.json();
      await saveBook(demo!);
      setBooks((prev) => [demo!, ...prev]);
    }
    if (demo) {
      handleSelectBook(demo, 0, 0);
    }
  };

  // Jump from citation to section
  const handleJumpToSection = (sectionId: string) => {
    if (!activeBook) return;
    const targetSection = activeBook.sections.find((s) => s.id === sectionId);
    if (targetSection) {
      setCurrentSection(targetSection);
      audioPlayer.playSection(activeBook, targetSection, 0, 0);
      setIsFullScreenPlayerOpen(true);
    }
  };

  const activeProgress = activeBook ? progressMap[activeBook.id] : undefined;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors">
      <OfflineIndicator />

      {/* Navigation (Sidebar on Desktop, Bottom bar on Mobile) */}
      <Navigation
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        hasActiveBook={Boolean(activeBook)}
      />

      {/* Main Content Area */}
      <div className="flex-1 md:pl-60 flex flex-col min-h-screen">
        {/* Minimal Header (Logo on left, one settings icon on right) */}
        <Header onOpenSettings={() => setIsSettingsOpen(true)} />

        {/* Dynamic Page Views based on Tab */}
        <main
          className={`flex-1 ${
            activeBook && currentSection ? 'pb-32 sm:pb-28' : 'pb-20'
          }`}
        >
          {currentTab === 'home' && (
            <HomeView
              onBookLoaded={handleBookLoaded}
              continueBook={activeBook}
              continueProgress={activeProgress}
              onResume={(b, secIdx, sentIdx) => handleSelectBook(b, secIdx, sentIdx)}
              onOpenCommute={() => setIsCommuteModeOpen(true)}
              onOpenStudy={() => setCurrentTab('study')}
              onOpenDemo={handleRunDemo}
            />
          )}

          {currentTab === 'library' && (
            <LibraryView
              books={books}
              progressMap={progressMap}
              activeBookId={activeBook?.id}
              onSelectBook={(b, secIdx) => handleSelectBook(b, secIdx ?? 0)}
              onOpenUpload={() => setCurrentTab('home')}
              onOpenDemo={handleRunDemo}
              onRefresh={async () => {
                const refreshed = await getAllBooks();
                setBooks(refreshed);
              }}
            />
          )}

          {currentTab === 'ask' && (
            <AskBookView
              activeBook={activeBook}
              currentSection={currentSection}
              onJumpToSection={handleJumpToSection}
              onOpenDemo={handleRunDemo}
            />
          )}

          {currentTab === 'study' && (
            <StudentView
              activeBook={activeBook}
              currentSection={currentSection}
              currentTime={currentTime}
              currentSentenceIndex={currentSentenceIndex}
              onPlayBookmark={(sectionId, timestampSeconds, sentenceIndex) => {
                if (!activeBook) return;
                const targetSec =
                  activeBook.sections.find((s) => s.id === sectionId) ||
                  activeBook.sections[0];
                setCurrentSection(targetSec);
                setCurrentSentenceIndex(sentenceIndex);
                audioPlayer.playSection(activeBook, targetSec, sentenceIndex, timestampSeconds);
                const formatTime = (secs: number) => {
                  const m = Math.floor(secs / 60);
                  const s = Math.floor(secs % 60);
                  return `${m}:${s < 10 ? '0' : ''}${s}`;
                };
                showToast(`Playing "${targetSec.title}" from ${formatTime(timestampSeconds)}`, 'info');
              }}
              onOpenDemo={handleRunDemo}
            />
          )}
        </main>

        {/* Slim Mini-Player: SHOWN ONLY WHEN A BOOK IS LOADED (Never covers content) */}
        {activeBook && currentSection && (
          <MiniPlayer
            book={activeBook}
            currentSection={currentSection}
            playbackStatus={playbackStatus}
            currentTime={currentTime}
            duration={duration}
            currentVoiceName={selectedVoiceName}
            onOpenFullScreen={() => setIsFullScreenPlayerOpen(true)}
          />
        )}
      </div>

      {/* Full-Screen Player Modal */}
      {activeBook && currentSection && (
        <FullScreenPlayer
          isOpen={isFullScreenPlayerOpen}
          book={activeBook}
          currentSection={currentSection}
          playbackStatus={playbackStatus}
          currentTime={currentTime}
          duration={duration}
          playbackRate={playbackRate}
          currentSentenceIndex={currentSentenceIndex}
          currentVoiceName={selectedVoiceName}
          onClose={() => setIsFullScreenPlayerOpen(false)}
          onOpenAsk={() => {
            setIsFullScreenPlayerOpen(false);
            setCurrentTab('ask');
          }}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          onRateChange={(rate) => {
            setPlaybackRate(rate);
            audioPlayer.setPlaybackRate(rate);
          }}
          onSentenceClick={(idx) => {
            setCurrentSentenceIndex(idx);
            audioPlayer.jumpToSentence(idx);
          }}
          onSelectSection={(sec) => {
            setCurrentSection(sec);
            audioPlayer.playSection(activeBook, sec, 0, 0);
          }}
        />
      )}

      {/* Commute Mode Fullscreen Dark Takeover */}
      {activeBook && currentSection && (
        <CommuteModeView
          isOpen={isCommuteModeOpen}
          book={activeBook}
          currentSection={currentSection}
          playbackStatus={playbackStatus}
          playbackRate={playbackRate}
          onClose={() => setIsCommuteModeOpen(false)}
          onOpenAskModal={() => {
            setIsCommuteModeOpen(false);
            setCurrentTab('ask');
          }}
          onRateChange={(rate) => {
            setPlaybackRate(rate);
            audioPlayer.setPlaybackRate(rate);
          }}
        />
      )}

      {/* Unified Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={theme}
        onThemeChange={(newTheme) => setTheme(newTheme)}
        currentLanguage={language}
        onLanguageChange={(newLang) => setLanguage(newLang)}
        currentVoiceName={selectedVoiceName}
        onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
        onReplayOnboarding={() => setIsOnboardingOpen(true)}
        onDataCleared={() => {
          setBooks([]);
          setActiveBook(null);
          setCurrentSection(null);
          setProgressMap({});
          setCurrentTab('home');
        }}
      />

      {/* Choose Voice Modal */}
      <VoiceSelectionModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
        selectedVoiceId={selectedVoiceId}
        onSelectVoice={(voice) => {
          setSelectedVoiceId(voice.id);
          setSelectedVoiceName(voice.displayName);
        }}
      />

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <PushtakApp />
    </ToastProvider>
  );
}
