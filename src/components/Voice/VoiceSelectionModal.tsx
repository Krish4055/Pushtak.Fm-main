import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Volume2,
  Play,
  Square,
  Check,
  RefreshCw,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { VoiceDefinition, FALLBACK_VOICES, DEFAULT_VOICE_ID } from '../../types';
import { audioPlayer } from '../../services/audioPlayer';
import { setSetting } from '../../services/db';
import { useToast } from '../Toast';

interface VoiceSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVoiceId: string;
  onSelectVoice: (voice: VoiceDefinition) => void;
}

type GenderFilter = 'all' | 'female' | 'male';

export const VoiceSelectionModal: React.FC<VoiceSelectionModalProps> = ({
  isOpen,
  onClose,
  selectedVoiceId,
  onSelectVoice,
}) => {
  const { showToast } = useToast();

  const [voices, setVoices] = useState<VoiceDefinition[]>(FALLBACK_VOICES);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterGender, setFilterGender] = useState<GenderFilter>('all');

  // Preview Audio state
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);

  // Cache for preview audio blob URLs: voiceId -> object URL
  // Caching ensures repeated taps never re-generate audio or spend Gnani API credits
  const previewAudioCacheRef = useRef<Map<string, string>>(new Map());
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchVoices();
    } else {
      stopPreview();
    }
  }, [isOpen]);

  const fetchVoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/voices');
      if (!resp.ok) {
        throw new Error(`Failed to load voices (HTTP ${resp.status})`);
      }
      const data = await resp.json();
      if (Array.isArray(data.voices) && data.voices.length > 0) {
        setVoices(data.voices);
      } else {
        setVoices(FALLBACK_VOICES);
      }
    } catch (err: any) {
      console.warn('[VoiceSelectionModal] Could not fetch remote voices, using fallback profiles:', err);
      setError('Unable to fetch live voice list from server. Displaying cached voice profiles.');
      setVoices(FALLBACK_VOICES);
    } finally {
      setLoading(false);
    }
  };

  const stopPreview = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }
    setPreviewingVoiceId(null);
    setIsPreviewLoading(false);
  };

  const handleTogglePreview = async (voice: VoiceDefinition) => {
    // If currently previewing this voice, stop it
    if (previewingVoiceId === voice.id) {
      stopPreview();
      return;
    }

    // Stop any existing preview first (single preview audio rule)
    stopPreview();
    setPreviewingVoiceId(voice.id);
    setIsPreviewLoading(true);

    try {
      let audioUrl = previewAudioCacheRef.current.get(voice.id);

      if (!audioUrl) {
        // Request fresh Timbre v2.5 synthesis from backend
        const resp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: voice.sampleSentence,
            language: voice.languages[0] || 'en',
            voice: voice.id,
            speed: 1.0,
          }),
        });

        const contentType = resp.headers.get('content-type') || '';
        if (resp.ok && (contentType.includes('audio') || contentType.includes('octet-stream'))) {
          const blob = await resp.blob();
          audioUrl = URL.createObjectURL(blob);
          previewAudioCacheRef.current.set(voice.id, audioUrl);
        } else {
          const errData = await resp.json().catch(() => null);
          const errorMsg = errData?.message || `Gnani preview failed (HTTP ${resp.status}), using device voice.`;
          showToast(errorMsg, 'info');

          // Fall back to Web Speech synthesis preview if server cannot generate audio
          if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(voice.sampleSentence);
            utt.lang = voice.languages[0]?.startsWith('hi') ? 'hi-IN' : 'en-US';
            utt.onend = () => {
              setPreviewingVoiceId(null);
              setIsPreviewLoading(false);
            };
            utt.onerror = () => {
              setPreviewingVoiceId(null);
              setIsPreviewLoading(false);
            };
            setIsPreviewLoading(false);
            window.speechSynthesis.speak(utt);
            return;
          }
          throw new Error('Preview audio could not be synthesized.');
        }
      }

      setIsPreviewLoading(false);
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onended = () => {
        setPreviewingVoiceId(null);
        activeAudioRef.current = null;
      };

      audio.onerror = () => {
        showToast('Preview audio playback failed.', 'error');
        setPreviewingVoiceId(null);
        activeAudioRef.current = null;
      };

      await audio.play();
    } catch (err: any) {
      console.error('[VoiceSelectionModal] Preview error:', err);
      showToast('Could not play voice preview. Please try again.', 'error');
      setPreviewingVoiceId(null);
      setIsPreviewLoading(false);
    }
  };

  const handleSelectVoice = async (voice: VoiceDefinition) => {
    stopPreview();
    onSelectVoice(voice);

    // Save selected voice per user in IndexedDB settings
    await setSetting('selected_voice_id', voice.id);
    await setSetting('selected_voice_name', voice.displayName);

    // Update audio player service
    audioPlayer.setVoice(voice.id);

    // Friendly prompt on voice transition
    const isCurrentlyPlaying = audioPlayer.getStatus() === 'playing';
    if (isCurrentlyPlaying) {
      showToast('New voice starts from the next section.', 'info');
    } else {
      showToast(`Narrator set to ${voice.displayName}.`, 'success');
    }

    onClose();
  };

  if (!isOpen) return null;

  // Filter voices by gender
  const filteredVoices = voices.filter((v) => {
    if (filterGender === 'all') return true;
    return v.gender === filterGender;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg max-h-[92vh] rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-serif-heading font-bold text-[var(--text-primary)]">
              Choose a Voice
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-ui mt-0.5">
              Gnani Timbre v3.0 natural narrator voices
            </p>
          </div>
          <button
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="p-2.5 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition tap-target flex items-center justify-center"
            aria-label="Close voice selection"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toggle: All / Female / Male */}
        <div className="px-6 pt-4 pb-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] w-full sm:w-auto">
            {(['all', 'female', 'male'] as GenderFilter[]).map((gender) => {
              const isActive = filterGender === gender;
              const label = gender === 'all' ? 'All Voices' : gender === 'female' ? 'Female' : 'Male';
              return (
                <button
                  key={gender}
                  onClick={() => setFilterGender(gender)}
                  className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-medium transition tap-target flex items-center justify-center ${
                    isActive
                      ? 'bg-[var(--bg-surface)] text-[var(--accent)] font-bold shadow-xs border border-[var(--border-subtle)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <span className="text-xs text-[var(--text-muted)] font-mono hidden sm:inline">
            {filteredVoices.length} {filteredVoices.length === 1 ? 'voice' : 'voices'}
          </span>
        </div>

        {/* Notice/Error Banner if fallback */}
        {error && (
          <div className="px-6 py-2.5 bg-[#FAF1E8] border-b border-[#E8DFD0] flex items-center justify-between text-xs text-[#6B5D50]">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchVoices}
              className="font-bold text-[var(--accent)] hover:underline flex items-center gap-1 ml-2 shrink-0 tap-target"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Scrollable Voice Cards (Single column on mobile) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[var(--text-secondary)]">
                Loading Gnani Timbre voices...
              </p>
            </div>
          ) : filteredVoices.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                No voices found matching filter.
              </p>
              <button
                onClick={() => setFilterGender('all')}
                className="text-xs font-bold text-[var(--accent)] hover:underline tap-target"
              >
                Reset filter to all
              </button>
            </div>
          ) : (
            filteredVoices.map((voice) => {
              const isSelected = selectedVoiceId === voice.id;
              const isPreviewing = previewingVoiceId === voice.id;

              return (
                <div
                  key={voice.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all text-left flex flex-col justify-between gap-3 ${
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--bg-surface-elevated)] ring-2 ring-[var(--accent)]/15 shadow-sm'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                  }`}
                >
                  {/* Top: Name, Gender Badge & Languages */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-serif-heading font-bold text-base text-[var(--text-primary)]">
                          {voice.displayName}
                        </h4>
                        {voice.isDefault && (
                          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#FAEDE7] text-[var(--accent)] border border-[#E8DFD0]">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] font-ui mt-1 leading-relaxed">
                        {voice.description}
                      </p>
                    </div>

                    <span className="text-[11px] font-medium text-[var(--text-muted)] capitalize px-2.5 py-1 rounded-lg bg-[var(--bg-surface-soft)] border border-[var(--border-subtle)] shrink-0">
                      {voice.gender}
                    </span>
                  </div>

                  {/* Sample Sentence Quote */}
                  <div className="p-2.5 rounded-xl bg-[var(--bg-surface-soft)] border border-[var(--border-subtle)]/70 text-xs font-reading text-[var(--text-secondary)] italic leading-relaxed">
                    "{voice.sampleSentence}"
                  </div>

                  {/* Actions: Preview & Select */}
                  <div className="flex items-center justify-between gap-2.5 pt-1">
                    {/* Preview Button */}
                    <button
                      onClick={() => handleTogglePreview(voice)}
                      disabled={isPreviewLoading && previewingVoiceId === voice.id}
                      className={`px-3.5 py-2.5 rounded-xl border text-xs font-medium transition tap-target flex items-center gap-2 ${
                        isPreviewing
                          ? 'border-[var(--accent)] text-[var(--accent)] bg-[#FAEDE7]'
                          : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
                      }`}
                      title="Listen to a voice preview"
                    >
                      {isPreviewLoading && previewingVoiceId === voice.id ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                          <span>Generating...</span>
                        </>
                      ) : isPreviewing ? (
                        <>
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop sample</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-[var(--accent)]" />
                          <span>Preview</span>
                        </>
                      )}
                    </button>

                    {/* Use this voice Button */}
                    {isSelected ? (
                      <div className="px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 tap-target">
                        <Check className="w-4 h-4 stroke-[2.5]" />
                        <span>Selected Voice</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleSelectVoice(voice)}
                        className="px-4 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[#A94522] text-white text-xs font-bold transition tap-target shadow-xs active:scale-98"
                      >
                        Use this voice
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex items-center justify-between text-xs text-[var(--text-secondary)] shrink-0">
          <span className="font-ui text-[11px]">
            Saved per user & applied to all Timbre reading and Q&A audio.
          </span>
          <button
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="text-xs font-bold text-[var(--accent)] hover:underline tap-target"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
