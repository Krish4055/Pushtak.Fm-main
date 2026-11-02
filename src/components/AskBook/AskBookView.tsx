import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Send,
  Volume2,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Play,
} from 'lucide-react';
import { ParsedBook, BookSection, AskMessage } from '../../types';
import { audioPlayer } from '../../services/audioPlayer';
import { useToast } from '../Toast';

interface AskBookViewProps {
  activeBook: ParsedBook | null;
  currentSection: BookSection | null;
  onJumpToSection: (sectionId: string) => void;
  onOpenDemo: () => void;
}

/**
 * Converts recorded browser audio blob (e.g. WebM) into 16-bit mono PCM WAV
 * Accepted by Gnani Prisma v3.0 (WAV, MP3, OGG, FLAC, AAC, M4A).
 */
async function convertAudioBlobToMonoWav(blob: Blob, targetSampleRate: number = 16000): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    const length = Math.floor(audioBuffer.length * (targetSampleRate / audioBuffer.sampleRate));

    // OfflineAudioContext mixes down to mono and resamples to targetSampleRate
    const offlineCtx = new OfflineAudioContext(1, length, targetSampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    const channelData = renderedBuffer.getChannelData(0); // Float32Array [-1.0, 1.0]

    // 16-bit PCM WAV encoding
    const bytesPerSample = 2;
    const pcmByteLength = channelData.length * bytesPerSample;
    const wavBuffer = new ArrayBuffer(44 + pcmByteLength);
    const view = new DataView(wavBuffer);

    // RIFF chunk
    view.setUint32(0, 0x52494646, false); // 'RIFF'
    view.setUint32(4, 36 + pcmByteLength, true);
    view.setUint32(8, 0x57415645, false); // 'WAVE'
    // fmt subchunk
    view.setUint32(12, 0x666d7420, false); // 'fmt '
    view.setUint32(16, 16, true);          // Subchunk1Size
    view.setUint16(20, 1, true);           // AudioFormat = PCM
    view.setUint16(22, 1, true);           // NumChannels = 1 (Mono)
    view.setUint32(24, targetSampleRate, true); // SampleRate
    view.setUint32(28, targetSampleRate * 1 * bytesPerSample, true); // ByteRate
    view.setUint16(32, 1 * bytesPerSample, true); // BlockAlign
    view.setUint16(34, 16, true);          // BitsPerSample
    // data subchunk
    view.setUint32(36, 0x64617461, false); // 'data'
    view.setUint32(40, pcmByteLength, true);

    let offset = 44;
    for (let i = 0; i < channelData.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  } finally {
    audioCtx.close().catch(() => {});
  }
}

export const AskBookView: React.FC<AskBookViewProps> = ({
  activeBook,
  currentSection,
  onJumpToSection,
}) => {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isAnswering, setIsAnswering] = useState(false);
  const [readingAnswerId, setReadingAnswerId] = useState<string | null>(null);
  const [wasPlayingBeforeQuestion, setWasPlayingBeforeQuestion] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const autoStopTimeoutRef = useRef<any>(null);
  const secondsIntervalRef = useRef<any>(null);

  const suggestedQuestions = [
    'What is the core takeaway of this section?',
    'What is the 20-minute focus ritual and how does it prevent mental fatigue?',
    'Explain Nishkama Karma simply in natural Hinglish',
  ];

  // Clean up recording timers on unmount
  useEffect(() => {
    return () => {
      if (autoStopTimeoutRef.current) clearTimeout(autoStopTimeoutRef.current);
      if (secondsIntervalRef.current) clearInterval(secondsIntervalRef.current);
    };
  }, []);

  // Voice recording via Prisma STT (Auto stops at 30 seconds)
  const startRecording = async () => {
    try {
      // Pause book while user speaks question
      if (audioPlayer.getStatus() === 'playing') {
        setWasPlayingBeforeQuestion(true);
        audioPlayer.pause();
        showToast('Book paused while listening', 'info');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingSeconds(0);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await processVoiceAudio(rawBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      showToast('Listening... (Maximum 30 seconds)', 'info');

      // Second counter
      secondsIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 29) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

      // Automatic 30-second cutoff enforced by Gnani STT limit
      autoStopTimeoutRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          showToast('30-second recording limit reached. Transcribing...', 'info');
          stopRecording();
        }
      }, 30000);
    } catch {
      showToast('Microphone access blocked. You can type your question below!', 'error');
    }
  };

  const stopRecording = () => {
    if (autoStopTimeoutRef.current) {
      clearTimeout(autoStopTimeoutRef.current);
      autoStopTimeoutRef.current = null;
    }
    if (secondsIntervalRef.current) {
      clearInterval(secondsIntervalRef.current);
      secondsIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceAudio = async (rawBlob: Blob) => {
    setIsAnswering(true);
    showToast('Converting to 16-bit mono WAV for Prisma v3.0...', 'info');

    try {
      // Convert browser WebM to 16-bit mono WAV accepted by Gnani
      const wavBlob = await convertAudioBlobToMonoWav(rawBlob, 16000);

      const formData = new FormData();
      formData.append('audio_file', wavBlob, 'question.wav');
      formData.append('model', 'prisma-v3.0');
      formData.append('language_code', 'indic-auto');

      const sttResp = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      const data = await sttResp.json();
      if (!sttResp.ok || data.error) {
        const statusText = sttResp.status ? `(HTTP ${sttResp.status})` : '';
        throw new Error(data.error || `Prisma voice transcription failed ${statusText}`);
      }

      const question = data.transcript;
      if (!question || !question.trim()) {
        showToast('No speech detected. Please try speaking again or type.', 'info');
        setIsAnswering(false);
        return;
      }

      await handleAskQuestion(question);
    } catch (err: any) {
      console.warn('[STT] Voice processing error:', err);
      showToast(err.message || 'Prisma voice error. Please type your question.', 'error');
      setIsAnswering(false);
    }
  };

  const handleAskQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;

    // Pause book while processing question
    if (audioPlayer.getStatus() === 'playing') {
      setWasPlayingBeforeQuestion(true);
      audioPlayer.pause();
    }

    const userMsg: AskMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: questionText,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsAnswering(true);

    try {
      const resp = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          bookId: activeBook?.id || 'demo-deep-focus',
          bookTitle: activeBook?.title || 'Book',
          language: activeBook?.language || 'en',
          currentSectionId: currentSection?.id,
          fallbackContext: currentSection?.text,
        }),
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => null);
        throw new Error(errJson?.error || `HTTP ${resp.status}: Could not generate answer.`);
      }

      const data = await resp.json();

      const geminiMsg: AskMessage = {
        id: `gemini-${Date.now()}`,
        sender: 'gemini',
        text: data.answer,
        citations: data.citations || [],
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, geminiMsg]);
    } catch (err: any) {
      const errorMsg: AskMessage = {
        id: `err-${Date.now()}`,
        sender: 'gemini',
        text: `Error retrieving answer: ${err.message}. Please try again.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleReadAnswerAloud = async (messageId: string, answerText: string) => {
    setReadingAnswerId(messageId);
    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: answerText,
          language: activeBook?.language || 'auto',
          voice: audioPlayer.getVoice(),
          speed: 1.0,
        }),
      });

      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && (contentType.includes('audio') || contentType.includes('octet-stream'))) {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => setReadingAnswerId(null);
        await audio.play();
      } else {
        const data = await resp.json().catch(() => null);
        if (data?.message) {
          showToast(data.message, 'info');
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          const utt = new SpeechSynthesisUtterance(answerText);
          utt.onend = () => setReadingAnswerId(null);
          window.speechSynthesis.speak(utt);
        } else {
          setReadingAnswerId(null);
        }
      }
    } catch (err: any) {
      showToast(`Playback error: ${err.message}`, 'error');
      setReadingAnswerId(null);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl sm:text-2xl font-serif-heading font-bold text-[var(--text-primary)] tracking-tight">
            Ask the Book
          </h2>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#FAEDE7] text-[var(--accent)] border border-[#E8DFD0]">
            Answers by Gemini
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1 font-reading">
          {activeBook ? (
            <span>
              Searching inside <strong>"{activeBook.title}"</strong> (RAG with Gemini)
            </span>
          ) : (
            <span>Ask questions grounded strictly in book content.</span>
          )}
        </p>
      </div>

      {/* Center Mic Button */}
      <div className="p-8 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center shadow-xs space-y-4">
        <div className="flex flex-col items-center justify-center">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-md transition-all duration-300 tap-target active:scale-95 ${
              isRecording
                ? 'bg-rose-600 text-white ring-8 ring-rose-500/20 animate-pulse'
                : 'bg-[var(--accent)] hover:bg-[#A94522] text-white'
            }`}
            title={isRecording ? 'Tap to finish (max 30s)' : 'Tap to speak question'}
            aria-label={isRecording ? 'Finish recording' : 'Speak question'}
          >
            {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
          </button>

          <p className="text-sm font-bold text-[var(--text-primary)] mt-4">
            {isRecording
              ? `Listening... (${30 - recordingSeconds}s remaining) Tap to send`
              : 'Tap mic to speak your question'}
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 font-ui">
            Powered by Gnani Prisma v3.0 (English, Hindi, Hinglish)
          </p>
        </div>

        {/* Fallback Text Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuestion(inputText);
          }}
          className="flex items-center gap-2 pt-2 max-w-md mx-auto"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Or type a question..."
            className="flex-1 px-4 py-2.5 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 tap-target"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isAnswering}
            className="p-2.5 rounded-2xl bg-[var(--accent)] hover:bg-[#A94522] disabled:opacity-40 text-white transition tap-target shrink-0 shadow-xs"
            aria-label="Send question"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Suggested Questions */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Suggested Questions
          </p>
          {suggestedQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleAskQuestion(q)}
              className="w-full p-3.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--accent)] text-left text-xs font-medium text-[var(--text-primary)] transition flex items-center justify-between group tap-target"
            >
              <span>"{q}"</span>
              <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-[var(--accent)] transition" />
            </button>
          ))}
        </div>
      )}

      {/* Answers & Q&A Stream */}
      {messages.length > 0 && (
        <div className="space-y-4 pt-2">
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Conversation
          </p>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-4 rounded-3xl text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-[var(--accent)] text-white font-medium ml-8'
                  : 'bg-[var(--bg-surface)] border border-[var(--border-subtle)] mr-8 font-reading shadow-xs text-[var(--text-primary)]'
              }`}
            >
              {msg.sender !== 'user' && (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)] mb-2 font-ui">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Answers by Gemini</span>
                </div>
              )}

              <p className="whitespace-pre-line">{msg.text}</p>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]/70 text-xs">
                  <p className="font-bold text-[var(--accent)] text-[11px] uppercase mb-1 flex items-center gap-1 font-ui">
                    <BookOpen className="w-3 h-3" /> Sources:
                  </p>
                  <div className="space-y-1">
                    {msg.citations.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-between text-xs"
                      >
                        <span className="font-bold truncate text-[var(--text-primary)]">
                          {c.sectionTitle}
                        </span>
                        <button
                          onClick={() => onJumpToSection(c.sectionId)}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold text-[var(--accent)] hover:underline shrink-0"
                        >
                          Jump
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Read Aloud & Resume Book Buttons */}
              {msg.sender !== 'user' && (
                <div className="mt-3 pt-2 flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => handleReadAnswerAloud(msg.id, msg.text)}
                    disabled={readingAnswerId === msg.id}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#FAEDE7] text-[var(--accent)] hover:bg-[#F5DDD3] transition flex items-center gap-1.5 tap-target"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>{readingAnswerId === msg.id ? 'Reading...' : 'Listen to Answer'}</span>
                  </button>

                  {activeBook && (
                    <button
                      onClick={() => {
                        audioPlayer.play();
                        setWasPlayingBeforeQuestion(false);
                        showToast('Resuming book playback...', 'info');
                      }}
                      className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[var(--accent)] text-white hover:bg-[#A94522] transition flex items-center gap-1.5 tap-target shadow-xs"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Resume book</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Sticky/Bottom helper prompt to resume reading */}
          {wasPlayingBeforeQuestion && activeBook && (
            <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 shadow-xs">
              <span className="text-xs text-[var(--text-secondary)] font-ui">
                Ready to continue listening to <strong>"{activeBook.title}"</strong>?
              </span>
              <button
                onClick={() => {
                  audioPlayer.play();
                  setWasPlayingBeforeQuestion(false);
                  showToast('Resuming book playback...', 'info');
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] text-white hover:bg-[#A94522] transition flex items-center gap-1.5 tap-target shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Resume book</span>
              </button>
            </div>
          )}

          {isAnswering && (
            <div className="p-4 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
              <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              <span>Gemini is reading book chunks and formulating answer...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
