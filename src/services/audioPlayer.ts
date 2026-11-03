/**
 * Pushtak.fm Persistent Audio Player & Media Session Engine
 * 
 * Provides Spotify / YouTube Music level lock-screen and background audio capabilities:
 * - Single persistent HTMLAudioElement attached to DOM (never recreated per chunk)
 * - Full Media Session API integration (lock screen, smartwatch, notification shade, Bluetooth)
 * - Dynamic Canvas Artwork generation (sizes 96, 128, 192, 256, 384, 512)
 * - Accurate setPositionState throttled to ~1s for lock-screen scrubber
 * - Zero-gap next section preloading and uninterrupted track switching
 * - Audio interruption handling (phone calls, other apps)
 * - Position persistence every 5s and on pagehide/visibilitychange
 * - Wake Lock API management (active only when reading along with screen visible)
 */

import { BookSection, ParsedBook, SentenceItem, DEFAULT_VOICE_ID } from '../types';
import {
  computeAudioCacheKey,
  getCachedAudioByKey,
  saveCachedAudio,
  saveProgress,
} from './db';

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export interface PlayerEvents {
  onStatusChange?: (status: PlaybackStatus) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onSentenceChange?: (sentenceIndex: number, sentence: SentenceItem | null) => void;
  onSectionComplete?: (section: BookSection) => void;
  onPreloadComplete?: (nextSectionId: string) => void;
  onError?: (error: string) => void;
  onEngineChange?: (engine: string) => void;
}

// In-memory artwork cache per book
const bookArtworkCache = new Map<string, MediaImage[]>();

/**
 * Dynamically generates a high-resolution book cover on canvas for lock-screen artwork
 */
async function generateBookCoverArtwork(book: ParsedBook): Promise<MediaImage[]> {
  if (bookArtworkCache.has(book.id)) {
    return bookArtworkCache.get(book.id)!;
  }

  const fallbackArtwork: MediaImage[] = [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ];

  if (typeof document === 'undefined') return fallbackArtwork;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return fallbackArtwork;

    // 1. Background gradient (Rich Terracotta)
    const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
    bgGrad.addColorStop(0, '#C2562F');
    bgGrad.addColorStop(1, '#8C2B0B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 512);

    // 2. Warm paper inner frame
    ctx.fillStyle = '#FAF6EF';
    ctx.fillRect(40, 40, 432, 432);

    // 3. Inner border
    ctx.strokeStyle = '#E8DFD0';
    ctx.lineWidth = 4;
    ctx.strokeRect(52, 52, 408, 408);

    // 4. Header: Brand
    ctx.fillStyle = '#C2562F';
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.fillText('PUSHTAK.FM', 256, 110);

    // 5. Decorative separator line
    ctx.strokeStyle = '#C2562F';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(180, 130);
    ctx.lineTo(332, 130);
    ctx.stroke();

    // 6. Book Title (Wrapped serif heading)
    ctx.fillStyle = '#2B2118';
    ctx.font = 'bold 36px serif';
    const words = book.title.split(' ');
    let line = '';
    let y = 220;
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 340 && i > 0) {
        ctx.fillText(line.trim(), 256, y);
        line = words[i] + ' ';
        y += 44;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), 256, y);

    // 7. Author Name
    ctx.fillStyle = '#6B5D50';
    ctx.font = 'italic 22px sans-serif';
    ctx.fillText(book.author || 'Pushtak Edition', 256, Math.min(410, y + 60));

    const coverDataUrl = canvas.toDataURL('image/png');
    const artwork: MediaImage[] = [
      { src: coverDataUrl, sizes: '96x96', type: 'image/png' },
      { src: coverDataUrl, sizes: '128x128', type: 'image/png' },
      { src: coverDataUrl, sizes: '192x192', type: 'image/png' },
      { src: coverDataUrl, sizes: '256x256', type: 'image/png' },
      { src: coverDataUrl, sizes: '384x384', type: 'image/png' },
      { src: coverDataUrl, sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ];

    bookArtworkCache.set(book.id, artwork);
    return artwork;
  } catch (err) {
    console.warn('[AudioPlayer] Could not render canvas artwork:', err);
    return fallbackArtwork;
  }
}

class AudioPlayerService {
  // 1. One persistent audio element attached to DOM
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  // Active state
  private currentBook: ParsedBook | null = null;
  private currentSection: BookSection | null = null;
  private currentSentenceIndex: number = 0;
  private playbackRate: number = 1.0;
  private voice: string = DEFAULT_VOICE_ID;
  private status: PlaybackStatus = 'idle';
  private events: PlayerEvents = {};

  // Next section preloaded audio cache
  private preloadedBlobs = new Map<string, Blob>();
  private preloadedSectionIds: Set<string> = new Set();
  private hasPreloadedNextForCurrentTrack: boolean = false;
  private isPreloadInFlight: boolean = false;
  private isPlayingFirstChunkOnly: boolean = false;
  private fullSectionBlobPromise: Promise<Blob | null> | null = null;

  // Sleep timer
  private sleepTimerId: any = null;
  private sleepTimerEndsAt: number | null = null;
  private stopAtSectionEnd: boolean = false;

  // Position & MediaSession throttling
  private lastPositionStateTime: number = -1;
  private periodicProgressTimer: any = null;

  // Wake Lock API state
  private wakeLockSentinel: any = null;
  private isReadingAlong: boolean = false;

  // Device Voice Speech Synthesis state
  private isUsingSpeechSynthesis: boolean = false;
  private synthSentenceTimer: any = null;
  private activeEngine: string = 'Gnani Timbre v3.0';

  constructor() {
    if (typeof window !== 'undefined') {
      this.initPersistentAudioElement();
      this.setupMediaSessionHandlers();
      this.setupLifecycleListeners();
    }
  }

  /**
   * Initializes the ONE persistent HTMLAudioElement attached to DOM.
   * Never recreated per chunk or section.
   */
  private initPersistentAudioElement() {
    if (this.audio) return;

    let el = document.getElementById('pushtak-global-audio') as HTMLAudioElement;
    if (!el) {
      el = document.createElement('audio');
      el.id = 'pushtak-global-audio';
      el.preload = 'auto';
      el.setAttribute('playsinline', 'true');
      el.setAttribute('webkit-playsinline', 'true');
      // Hidden from screen layout, but permanently retained in DOM for mobile OS background playback
      el.style.position = 'fixed';
      el.style.top = '-9999px';
      el.style.left = '-9999px';
      el.style.width = '1px';
      el.style.height = '1px';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      document.body.appendChild(el);
    }

    this.audio = el;
    this.attachAudioEventListeners();
  }

  private attachAudioEventListeners() {
    if (!this.audio) return;

    this.audio.addEventListener('timeupdate', () => {
      if (!this.audio) return;
      const currentTime = this.audio.currentTime;
      const duration = this.audio.duration || this.currentSection?.estimatedDurationSeconds || 0;

      this.events.onTimeUpdate?.(currentTime, duration);
      this.updateKaraokeSentence(currentTime, duration);

      // Throttle setPositionState to ~once every 1 second
      if (Math.abs(currentTime - this.lastPositionStateTime) >= 1.0) {
        this.updateMediaSessionPositionState(currentTime, duration);
      }

      // Preload next section once current track is well underway (>= 20s or 25% progress)
      // to avoid overlapping TTS requests and 429 rate limits
      if (
        duration > 0 &&
        (currentTime >= 20 || currentTime / duration >= 0.25) &&
        !this.hasPreloadedNextForCurrentTrack
      ) {
        this.hasPreloadedNextForCurrentTrack = true;
        if (this.currentBook && this.currentSection) {
          this.preloadNextSection(this.currentBook, this.currentSection);
        }
      }
    });

    this.audio.addEventListener('ended', () => {
      this.handleTrackEnded();
    });

    this.audio.addEventListener('play', () => {
      this.setStatus('playing');
      this.updateMediaSessionPlaybackState('playing');
      this.startPeriodicProgressTimer();
      this.syncWakeLock();
    });

    this.audio.addEventListener('pause', () => {
      if (this.status !== 'loading') {
        this.setStatus('paused');
        this.updateMediaSessionPlaybackState('paused');
        this.stopPeriodicProgressTimer();
        this.persistProgress(); // Save position on interruption / pause
        this.releaseWakeLock();
      }
    });

    this.audio.addEventListener('ratechange', () => {
      if (!this.audio) return;
      this.updateMediaSessionPositionState(
        this.audio.currentTime,
        this.audio.duration || this.currentSection?.estimatedDurationSeconds || 0
      );
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('[AudioPlayer] Audio playback error on element:', e);
      if (this.currentSection) {
        this.events.onError?.('Playback interrupted. Switching to device voice (lock-screen controls unavailable).');
        this.playWithSpeechSynthesis(this.currentSection, this.currentSentenceIndex);
      } else {
        this.setStatus('error');
      }
    });
  }

  /**
   * Listen to tab lifecycle to guarantee exact position persistence before tab is discarded
   */
  private setupLifecycleListeners() {
    if (typeof document === 'undefined') return;

    // When user locks phone screen or switches app
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.persistProgress();
        // Release wake lock when screen is turned off or tab hidden
        this.releaseWakeLock();
      } else if (document.visibilityState === 'visible' && this.status === 'playing') {
        this.syncWakeLock();
      }
    });

    // When page is unloaded or killed
    window.addEventListener('pagehide', () => {
      this.persistProgress();
      this.releaseWakeLock();
    });

    window.addEventListener('beforeunload', () => {
      this.persistProgress();
    });
  }

  public setEvents(events: PlayerEvents) {
    this.events = events;
  }

  public getStatus(): PlaybackStatus {
    return this.status;
  }

  public getCurrentBook(): ParsedBook | null {
    return this.currentBook;
  }

  public getCurrentSection(): BookSection | null {
    return this.currentSection;
  }

  public getCurrentSentenceIndex(): number {
    return this.currentSentenceIndex;
  }

  public getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  public getDuration(): number {
    return this.audio?.duration || this.currentSection?.estimatedDurationSeconds || 0;
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }

  public getActiveEngine(): string {
    return this.activeEngine;
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.75, Math.min(2.0, rate));
    if (this.audio) {
      this.audio.playbackRate = this.playbackRate;
    }
    if (this.isUsingSpeechSynthesis && this.currentSection) {
      this.playWithSpeechSynthesis(this.currentSection, this.currentSentenceIndex);
    }
  }

  public getVoice(): string {
    return this.voice;
  }

  public setVoice(voice: string) {
    if (this.voice !== voice) {
      this.voice = voice;
      this.preloadedBlobs.clear();
      this.preloadedSectionIds.clear();
      console.log(`[AudioPlayer] Voice set to "${voice}". Next section will synthesize with this voice.`);
    }
  }

  public setReadingAlong(readingAlong: boolean) {
    this.isReadingAlong = readingAlong;
    this.syncWakeLock();
  }

  /**
   * Set up Web Audio Analyser for reactive waveforms
   */
  public getAnalyserData(): Uint8Array | null {
    if (!this.analyser) {
      try {
        if (!this.audioContext && typeof window !== 'undefined') {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            this.audioContext = new AudioContextClass();
          }
        }
        if (this.audioContext && this.audio && !this.sourceNode) {
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 64;
          this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
          this.sourceNode.connect(this.analyser);
          this.analyser.connect(this.audioContext.destination);
        }
      } catch {
        return null;
      }
    }

    if (!this.analyser) return null;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  /**
   * Play a specific section using the ONE persistent audio element
   */
  public async playSection(
    book: ParsedBook,
    section: BookSection,
    startSentenceIndex: number = 0,
    startTimeSeconds: number = 0
  ) {
    this.initPersistentAudioElement();
    this.currentBook = book;
    this.currentSection = section;
    this.currentSentenceIndex = startSentenceIndex;
    this.setStatus('loading');

    // Update lock screen metadata immediately
    this.updateMediaSessionMetadata(book, section);

    // Stop speech synthesis if it was active
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      this.isUsingSpeechSynthesis = false;
      if (this.synthSentenceTimer) clearTimeout(this.synthSentenceTimer);
    }

    try {
      const cacheKey = await computeAudioCacheKey(
        section.text,
        this.voice,
        book.language,
        this.playbackRate
      );

      // Check in-memory preloaded blob or IndexedDB cache
      let audioBlob: Blob | null = this.preloadedBlobs.get(section.id) || null;
      if (!audioBlob) {
        const cached = await getCachedAudioByKey(cacheKey);
        if (cached) {
          audioBlob = cached.blob;
          this.activeEngine = 'IndexedDB Cache (Gnani Timbre v3.0)';
          this.events.onEngineChange?.(this.activeEngine);
        }
      }

      if (!audioBlob) {
        // 1. Kick off full section synthesis in background for gapless continuity
        this.fullSectionBlobPromise = (async () => {
          try {
            const fullResp = await fetch('/api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: section.text,
                language: book.language,
                voice: this.voice,
                speed: this.playbackRate,
                sectionId: section.id,
              }),
            });
            if (fullResp.ok) {
              const fullBlob = await fullResp.blob();
              await saveCachedAudio({
                cacheKey,
                sectionId: section.id,
                blob: fullBlob,
                mimeType: fullResp.headers.get('content-type') || 'audio/wav',
                durationEstimateSeconds: section.estimatedDurationSeconds,
                speed: this.playbackRate,
                voice: this.voice,
                language: book.language,
              });
              this.preloadedBlobs.set(section.id, fullBlob);
              return fullBlob;
            }
          } catch (e) {
            console.warn('[AudioPlayer] Background full synthesis failed:', e);
          }
          return null;
        })();

        // 2. Fast-path: Synthesize chunk 1 for instant (< 1.5s) playback start
        console.log(`[AudioPlayer] Synthesizing instant start for "${section.title}" (Voice: ${this.voice})...`);
        let resp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: section.text,
            language: book.language,
            voice: this.voice,
            speed: this.playbackRate,
            sectionId: section.id,
            firstChunkOnly: true,
          }),
        });

        // Graceful fallback to default voice 'Lakshmi' if chosen voice fails
        if (!resp.ok && this.voice !== DEFAULT_VOICE_ID) {
          console.warn(`[AudioPlayer] Voice "${this.voice}" failed. Retrying with default voice "${DEFAULT_VOICE_ID}"...`);
          resp = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: section.text,
              language: book.language,
              voice: DEFAULT_VOICE_ID,
              speed: this.playbackRate,
              sectionId: section.id,
              firstChunkOnly: true,
            }),
          });
        }

        const contentType = resp.headers.get('content-type') || '';
        const voiceEngineHeader = resp.headers.get('x-voice-engine') || 'Gnani Timbre v3.0';
        const totalChunksHeader = resp.headers.get('x-total-chunks') || '1';
        const isFirstChunk = resp.headers.get('x-first-chunk') === 'true';
        this.isPlayingFirstChunkOnly = isFirstChunk && totalChunksHeader !== '1';

        this.activeEngine = voiceEngineHeader;
        this.events.onEngineChange?.(this.activeEngine);

        if (resp.ok && (contentType.includes('audio') || contentType.includes('octet-stream'))) {
          audioBlob = await resp.blob();

          if (!this.isPlayingFirstChunkOnly) {
            // Save full single-chunk audio directly
            await saveCachedAudio({
              cacheKey,
              sectionId: section.id,
              blob: audioBlob,
              mimeType: contentType,
              durationEstimateSeconds: section.estimatedDurationSeconds,
              speed: this.playbackRate,
              voice: this.voice,
              language: book.language,
            });
            this.preloadedBlobs.set(section.id, audioBlob);
          }
        } else {
          // Server signaled browser speech fallback
          const data = await resp.json().catch(() => null);
          const fallbackMsg = data?.message || 'Gnani voice failed, using device voice. Lock-screen controls are not available in device voice mode.';
          this.activeEngine = 'Device Natural Voice';
          this.events.onEngineChange?.(this.activeEngine);
          this.events.onError?.(fallbackMsg);
          this.playWithSpeechSynthesis(section, startSentenceIndex);
          return;
        }
      } else {
        this.isPlayingFirstChunkOnly = false;
      }

      // Play audio blob with the ONE persistent HTMLAudioElement
      if (this.audio && audioBlob) {
        this.hasPreloadedNextForCurrentTrack = false;
        const audioUrl = URL.createObjectURL(audioBlob);
        this.audio.src = audioUrl;
        this.audio.playbackRate = this.playbackRate;

        if (startTimeSeconds > 0) {
          this.audio.currentTime = startTimeSeconds;
        }

        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        await this.audio.play();
        this.setStatus('playing');
        this.persistProgress();
      }
    } catch (err: any) {
      console.warn('[AudioPlayer] Audio playback error:', err);
      const fallbackMsg = `Gnani voice failed, using device voice. Lock-screen controls are not available in device voice mode. (${err.message || 'Error'})`;
      this.events.onError?.(fallbackMsg);
      this.activeEngine = 'Device Natural Voice (Fallback)';
      this.events.onEngineChange?.(this.activeEngine);
      this.playWithSpeechSynthesis(section, startSentenceIndex);
    }
  }

  /**
   * Pre-generate and join the NEXT section in the background so track transitions are instant
   */
  public async preloadNextSection(book: ParsedBook, currentSection: BookSection) {
    if (this.isPreloadInFlight) return;
    const nextSectionIndex = currentSection.sectionIndex + 1;
    if (nextSectionIndex >= book.sections.length) return;

    const nextSection = book.sections[nextSectionIndex];
    if (this.preloadedSectionIds.has(nextSection.id)) return;
    this.preloadedSectionIds.add(nextSection.id);
    this.isPreloadInFlight = true;

    try {
      const nextCacheKey = await computeAudioCacheKey(
        nextSection.text,
        this.voice,
        book.language,
        this.playbackRate
      );

      const alreadyCached = await getCachedAudioByKey(nextCacheKey);
      if (alreadyCached) {
        this.preloadedBlobs.set(nextSection.id, alreadyCached.blob);
        console.log(`[AudioPlayer] Next section "${nextSection.title}" ready from cache.`);
        this.events.onPreloadComplete?.(nextSection.id);
        return;
      }

      console.log(`[AudioPlayer] Pre-generating next section "${nextSection.title}" in background...`);
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: nextSection.text,
          language: book.language,
          voice: this.voice,
          speed: this.playbackRate,
          sectionId: nextSection.id,
        }),
      });

      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && (contentType.includes('audio') || contentType.includes('octet-stream'))) {
        const blob = await resp.blob();
        this.preloadedBlobs.set(nextSection.id, blob);
        await saveCachedAudio({
          cacheKey: nextCacheKey,
          sectionId: nextSection.id,
          blob,
          mimeType: contentType,
          durationEstimateSeconds: nextSection.estimatedDurationSeconds,
          speed: this.playbackRate,
          voice: this.voice,
          language: book.language,
        });
        console.log(`[AudioPlayer] Next section "${nextSection.title}" pre-generated and cached.`);
        this.events.onPreloadComplete?.(nextSection.id);
      }
    } catch (err) {
      console.warn('[AudioPlayer] Background preload of next section failed (non-critical):', err);
    } finally {
      this.isPreloadInFlight = false;
    }
  }

  public async play() {
    if (this.isUsingSpeechSynthesis) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          this.setStatus('playing');
        } else if (this.currentSection) {
          this.playWithSpeechSynthesis(this.currentSection, this.currentSentenceIndex);
        }
      }
      return;
    }

    if (this.audio) {
      try {
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        await this.audio.play();
        this.setStatus('playing');
        this.updateMediaSessionPlaybackState('playing');
      } catch (err: any) {
        console.warn('[AudioPlayer] Play invocation failed:', err);
      }
    }
  }

  public pause() {
    if (this.isUsingSpeechSynthesis) {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.pause();
        this.setStatus('paused');
      }
      return;
    }

    if (this.audio) {
      this.audio.pause();
      this.setStatus('paused');
      this.updateMediaSessionPlaybackState('paused');
      this.persistProgress();
    }
  }

  public togglePlayPause() {
    if (this.status === 'playing') {
      this.pause();
    } else {
      this.play();
    }
  }

  public stop() {
    this.pause();
    if (this.audio) {
      this.audio.currentTime = 0;
    }
    this.setStatus('idle');
    this.updateMediaSessionPlaybackState('none');
  }

  public seekBy(seconds: number) {
    if (this.audio && this.audio.duration) {
      const newTime = Math.max(0, Math.min(this.audio.duration, this.audio.currentTime + seconds));
      this.audio.currentTime = newTime;
      this.updateMediaSessionPositionState(newTime, this.audio.duration);
      this.persistProgress();
    } else if (this.currentSection) {
      const deltaSentences = Math.round(seconds / 5);
      const newIdx = Math.max(0, Math.min(this.currentSection.sentences.length - 1, this.currentSentenceIndex + deltaSentences));
      this.jumpToSentence(newIdx);
    }
  }

  public async seekTo(targetSeconds: number) {
    if (this.isPlayingFirstChunkOnly && this.currentSection) {
      const fullBlob = this.preloadedBlobs.get(this.currentSection.id) || (await this.fullSectionBlobPromise);
      if (fullBlob && this.audio) {
        this.isPlayingFirstChunkOnly = false;
        const fullUrl = URL.createObjectURL(fullBlob);
        this.audio.src = fullUrl;
        this.audio.playbackRate = this.playbackRate;
      }
    }
    if (this.audio && this.audio.duration) {
      const clamped = Math.max(0, Math.min(this.audio.duration, targetSeconds));
      this.audio.currentTime = clamped;
      this.updateMediaSessionPositionState(clamped, this.audio.duration);
      this.persistProgress();
    }
  }

  public seekToRatio(ratio: number) {
    const clamped = Math.max(0, Math.min(1.0, ratio));
    if (this.audio && this.audio.duration) {
      const targetTime = clamped * this.audio.duration;
      this.seekTo(targetTime);
    } else if (this.currentSection) {
      const targetSentenceIdx = Math.floor(clamped * this.currentSection.sentences.length);
      this.jumpToSentence(targetSentenceIdx);
    }
  }

  public jumpToSentence(sentenceIndex: number) {
    if (!this.currentSection) return;
    const clampedIndex = Math.max(0, Math.min(this.currentSection.sentences.length - 1, sentenceIndex));
    this.currentSentenceIndex = clampedIndex;

    const fraction = clampedIndex / Math.max(1, this.currentSection.sentences.length);
    if (this.audio && this.audio.duration) {
      this.audio.currentTime = fraction * this.audio.duration;
      this.updateMediaSessionPositionState(this.audio.currentTime, this.audio.duration);
    }

    if (this.isUsingSpeechSynthesis) {
      this.playWithSpeechSynthesis(this.currentSection, clampedIndex);
    }

    this.events.onSentenceChange?.(clampedIndex, this.currentSection.sentences[clampedIndex] || null);
    this.persistProgress();
  }

  public nextSection() {
    if (!this.currentBook || !this.currentSection) return;
    const nextIdx = this.currentSection.sectionIndex + 1;
    if (nextIdx < this.currentBook.sections.length) {
      const nextSection = this.currentBook.sections[nextIdx];
      this.playSection(this.currentBook, nextSection, 0, 0);
    }
  }

  public previousSection() {
    if (!this.currentBook || !this.currentSection) return;
    const prevIdx = this.currentSection.sectionIndex - 1;
    if (prevIdx >= 0) {
      const prevSection = this.currentBook.sections[prevIdx];
      this.playSection(this.currentBook, prevSection, 0, 0);
    }
  }

  // --- Sleep Timer ---
  public setSleepTimer(minutes: number) {
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
      this.sleepTimerEndsAt = null;
    }

    if (minutes === -1) {
      this.stopAtSectionEnd = true;
      this.sleepTimerEndsAt = null;
      return;
    }

    this.stopAtSectionEnd = false;
    if (minutes <= 0) return;

    this.sleepTimerEndsAt = Date.now() + minutes * 60 * 1000;
    this.sleepTimerId = setTimeout(() => {
      this.fadeAndPause();
    }, minutes * 60 * 1000);
  }

  public getSleepTimerRemainingSeconds(): number | null {
    if (this.stopAtSectionEnd) return -1;
    if (!this.sleepTimerEndsAt) return null;
    return Math.max(0, Math.round((this.sleepTimerEndsAt - Date.now()) / 1000));
  }

  public cancelSleepTimer() {
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
      this.sleepTimerEndsAt = null;
    }
    this.stopAtSectionEnd = false;
  }

  private fadeAndPause() {
    if (this.audio && this.status === 'playing') {
      let vol = this.audio.volume;
      const fadeInterval = setInterval(() => {
        vol = Math.max(0, vol - 0.1);
        if (this.audio) this.audio.volume = vol;
        if (vol <= 0.05) {
          clearInterval(fadeInterval);
          this.pause();
          if (this.audio) this.audio.volume = 1.0;
        }
      }, 100);
    } else {
      this.pause();
    }
    this.cancelSleepTimer();
  }

  /**
   * Track ended handler: Seamlessly transition to preloaded next section
   */
  private async handleTrackEnded() {
    if (!this.currentBook || !this.currentSection) return;

    // If we just finished chunk 1 of a multi-chunk section, continue seamlessly with full audio
    if (this.isPlayingFirstChunkOnly && this.currentSection) {
      this.isPlayingFirstChunkOnly = false;
      const fullBlob = this.preloadedBlobs.get(this.currentSection.id) || (await this.fullSectionBlobPromise);
      if (fullBlob && this.audio) {
        const chunk1Elapsed = this.audio.currentTime || 0;
        const fullUrl = URL.createObjectURL(fullBlob);
        this.audio.src = fullUrl;
        this.audio.playbackRate = this.playbackRate;
        this.audio.currentTime = chunk1Elapsed;
        this.audio.play().catch(console.error);
        return;
      }
    }

    this.events.onSectionComplete?.(this.currentSection);

    if (this.stopAtSectionEnd) {
      this.pause();
      this.cancelSleepTimer();
      return;
    }

    const nextIdx = this.currentSection.sectionIndex + 1;
    if (nextIdx < this.currentBook.sections.length) {
      const nextSection = this.currentBook.sections[nextIdx];
      // Keep audio element playing across section changes
      this.playSection(this.currentBook, nextSection, 0, 0);
    } else {
      this.setStatus('paused');
      this.updateMediaSessionPlaybackState('paused');
    }
  }

  private setStatus(newStatus: PlaybackStatus) {
    this.status = newStatus;
    this.events.onStatusChange?.(newStatus);
  }

  /**
   * Persist exact reading and audio progress to IndexedDB
   */
  public persistProgress() {
    if (!this.currentBook || !this.currentSection) return;

    saveProgress({
      bookId: this.currentBook.id,
      currentSectionId: this.currentSection.id,
      currentSectionIndex: this.currentSection.sectionIndex,
      currentSentenceIndex: this.currentSentenceIndex,
      currentTimeSeconds: this.audio?.currentTime || 0,
      playbackRate: this.playbackRate,
      lastListenedAt: Date.now(),
      completedSectionIds: [],
    });
  }

  private startPeriodicProgressTimer() {
    this.stopPeriodicProgressTimer();
    // Persist position every 5 seconds while actively playing
    this.periodicProgressTimer = setInterval(() => {
      this.persistProgress();
    }, 5000);
  }

  private stopPeriodicProgressTimer() {
    if (this.periodicProgressTimer) {
      clearInterval(this.periodicProgressTimer);
      this.periodicProgressTimer = null;
    }
  }

  // --- Wake Lock Management ---
  private async syncWakeLock() {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    // Only acquire wake lock if screen is visible, audio is playing, and user is reading along
    if (
      this.status === 'playing' &&
      this.isReadingAlong &&
      document.visibilityState === 'visible' &&
      !this.wakeLockSentinel
    ) {
      try {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
        });
      } catch {
        // Wake lock may fail due to battery saver, ignore gracefully
      }
    }
  }

  private releaseWakeLock() {
    if (this.wakeLockSentinel) {
      this.wakeLockSentinel.release().catch(() => { });
      this.wakeLockSentinel = null;
    }
  }

  // --- Media Session API (Lock Screen, Smartwatch, Notification Shade, Bluetooth) ---
  private setupMediaSessionHandlers() {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      navigator.mediaSession.setActionHandler('play', () => this.play());
      navigator.mediaSession.setActionHandler('pause', () => this.pause());
      navigator.mediaSession.setActionHandler('stop', () => this.stop());
      navigator.mediaSession.setActionHandler('previoustrack', () => this.previousSection());
      navigator.mediaSession.setActionHandler('nexttrack', () => this.nextSection());
      navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        this.seekBy(-(details?.seekOffset || 15));
      });
      navigator.mediaSession.setActionHandler('seekforward', (details) => {
        this.seekBy(details?.seekOffset || 15);
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details?.seekTime !== undefined && !isNaN(details.seekTime)) {
          this.seekTo(details.seekTime);
        }
      });
    } catch (err) {
      console.warn('[AudioPlayer] Error registering MediaSession action handlers:', err);
    }
  }

  private async updateMediaSessionMetadata(book: ParsedBook, section: BookSection) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    const artwork = await generateBookCoverArtwork(book);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: section.title,
      artist: book.title,
      album: 'Pushtak',
      artwork,
    });
  }

  private updateMediaSessionPlaybackState(state: 'playing' | 'paused' | 'none') {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (this.isUsingSpeechSynthesis) {
      navigator.mediaSession.playbackState = 'none';
      return;
    }
    navigator.mediaSession.playbackState = state;
  }

  private updateMediaSessionPositionState(position: number, duration: number) {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;
    if (!('setPositionState' in navigator.mediaSession)) return;
    if (this.isUsingSpeechSynthesis) return;

    if (duration > 0 && !isNaN(duration) && !isNaN(position) && position <= duration) {
      try {
        navigator.mediaSession.setPositionState({
          duration: Math.max(0, duration),
          playbackRate: this.playbackRate,
          position: Math.max(0, Math.min(position, duration)),
        });
        this.lastPositionStateTime = position;
      } catch (err) {
        // Ignore edge-case timestamp mismatch errors
      }
    }
  }

  // --- Sentence-by-Sentence Synchronized Karaoke Highlighting ---
  private updateKaraokeSentence(currentTime: number, duration: number) {
    if (!this.currentSection || this.currentSection.sentences.length === 0 || duration <= 0) return;

    const fraction = Math.min(1.0, Math.max(0, currentTime / duration));
    const totalSentences = this.currentSection.sentences.length;
    const estimatedIndex = Math.min(totalSentences - 1, Math.floor(fraction * totalSentences));

    if (estimatedIndex !== this.currentSentenceIndex) {
      this.currentSentenceIndex = estimatedIndex;
      this.events.onSentenceChange?.(estimatedIndex, this.currentSection.sentences[estimatedIndex]);
    }
  }

  // --- Fallback: Web Speech API (Device Voice) ---
  private playWithSpeechSynthesis(section: BookSection, startSentenceIndex: number = 0) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      this.setStatus('error');
      return;
    }

    window.speechSynthesis.cancel();
    this.isUsingSpeechSynthesis = true;
    this.currentSentenceIndex = startSentenceIndex;
    this.setStatus('playing');
    this.updateMediaSessionPlaybackState('none');

    const totalSentences = section.sentences.length;
    if (totalSentences === 0) return;

    const speakSentenceAt = (index: number) => {
      if (!this.isUsingSpeechSynthesis || index >= totalSentences) {
        this.handleTrackEnded();
        return;
      }

      const item = section.sentences[index];
      const utterance = new SpeechSynthesisUtterance(item.text);
      utterance.rate = this.playbackRate;

      const lang = this.currentBook?.language || 'en';
      utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'ta' ? 'ta-IN' : 'en-US';

      utterance.onstart = () => {
        this.currentSentenceIndex = index;
        this.events.onSentenceChange?.(index, item);
        const estSec = (index / totalSentences) * section.estimatedDurationSeconds;
        this.events.onTimeUpdate?.(estSec, section.estimatedDurationSeconds);
      };

      utterance.onend = () => {
        speakSentenceAt(index + 1);
      };

      utterance.onerror = (e) => {
        if (e.error !== 'canceled') {
          console.warn('[WebSpeech] Utterance error:', e.error);
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakSentenceAt(startSentenceIndex);
  }

  /**
   * Export and download current section audio as a high-fidelity WAV file for offline listening
   */
  public async downloadCurrentSectionAudio(): Promise<{ success: boolean; filename?: string; error?: string }> {
    if (!this.currentBook || !this.currentSection) {
      return { success: false, error: 'No active chapter is currently selected.' };
    }

    try {
      const book = this.currentBook;
      const section = this.currentSection;
      let blob: Blob | undefined = this.preloadedBlobs.get(section.id);

      if (!blob) {
        const cacheKey = await computeAudioCacheKey(
          section.text,
          this.voice,
          book.language,
          this.playbackRate
        );
        const cached = await getCachedAudioByKey(cacheKey);
        if (cached) blob = cached.blob;
      }

      if (!blob) {
        const resp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: section.text,
            language: book.language,
            voice: this.voice,
            speed: this.playbackRate,
            sectionId: section.id,
          }),
        });

        if (resp.ok) {
          blob = await resp.blob();
        } else {
          return { success: false, error: 'Could not generate audio stream for download.' };
        }
      }

      if (blob && typeof window !== 'undefined') {
        const safeTitle = `${book.title} - ${section.title}`.replace(/[\\/:*?"<>|]/g, '_');
        const filename = `${safeTitle}.wav`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        return { success: true, filename };
      }

      return { success: false, error: 'Audio data unavailable.' };
    } catch (err: any) {
      console.error('[AudioPlayer] Audio download error:', err);
      return { success: false, error: err.message || 'Download failed' };
    }
  }
}

export const audioPlayer = new AudioPlayerService();
