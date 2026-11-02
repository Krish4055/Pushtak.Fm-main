import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Send,
  Volume2,
  ExternalLink,
  Sparkles,
  X,
  AlertCircle,
  HelpCircle,
  BookOpen,
  ArrowRight,
} from 'lucide-react';
import { ParsedBook, BookSection, AskMessage } from '../../types';
import { audioPlayer } from '../../services/audioPlayer';
import { useToast } from '../Toast';

interface AskBookModalProps {
  isOpen: boolean;
  book: ParsedBook;
  currentSection: BookSection;
  onClose: () => void;
  onJumpToSection: (sectionId: string) => void;
  initialQuestion?: string;
}

export const AskBookModal: React.FC<AskBookModalProps> = ({
  isOpen,
  book,
  currentSection,
  onClose,
  onJumpToSection,
  initialQuestion,
}) => {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [readingAnswerId, setReadingAnswerId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Suggested questions based on the current book
  const suggestedQuestions = [
    'What is the core message of this book?',
    'What is the 20-minute focus ritual and how does it prevent mental fatigue?',
    'Explain the concept of Nishkama Karma in simple Hinglish',
    'How does commute listening help retention compared to scrolling?',
  ];

  // Auto-fill initial question if provided (e.g. from 60s demo)
  useEffect(() => {
    if (initialQuestion && isOpen) {
      handleAskQuestion(initialQuestion);
    }
  }, [initialQuestion, isOpen]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isAnswering]);

  if (!isOpen) return null;

  // Start Voice Recording with Prisma STT
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());
        await processVoiceAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      showToast('Listening... Speak your question in English, Hindi, or Hinglish', 'info');
    } catch (err: any) {
      console.warn('[Prisma STT] Microphone access failed:', err);
      showToast('Microphone access blocked. You can type your question below!', 'error');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processVoiceAudio = async (blob: Blob) => {
    setIsAnswering(true);
    showToast('Transcribing voice via Gnani Prisma v2.5...', 'info');

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'question.webm');
      formData.append('language', 'hi-en'); // Hinglish / Indian language detection

      const sttResp = await fetch('/api/stt', {
        method: 'POST',
        body: formData,
      });

      if (!sttResp.ok) {
        throw new Error('Voice transcription failed.');
      }

      const sttData = await sttResp.json();
      const question = sttData.transcript;

      if (!question || !question.trim()) {
        showToast('No speech detected. Please try again or type.', 'info');
        setIsAnswering(false);
        return;
      }

      await handleAskQuestion(question);
    } catch (err: any) {
      console.error('[AskBook] Voice error:', err);
      showToast('Prisma voice recognition encountered an issue. Using typed fallback.', 'error');
      setIsAnswering(false);
    }
  };

  const handleAskQuestion = async (questionText: string) => {
    if (!questionText.trim()) return;

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
      // Send question + bookId to backend Evon v3.3 RAG pipeline
      // Backend automatically retrieves ONLY top relevant chunks (never sending full 500 pages!)
      const resp = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          bookId: book.id,
          bookTitle: book.title,
          language: book.language,
          currentSectionId: currentSection.id,
          fallbackContext: currentSection.text,
        }),
      });

      if (!resp.ok) {
        throw new Error('Evon v3.3 could not answer at this moment.');
      }

      const data = await resp.json();

      const evonMsg: AskMessage = {
        id: `evon-${Date.now()}`,
        sender: 'evon',
        text: data.answer,
        citations: data.citations || [],
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, evonMsg]);
    } catch (err: any) {
      const errorMsg: AskMessage = {
        id: `err-${Date.now()}`,
        sender: 'evon',
        text: `I encountered an issue retrieving the answer: ${err.message}. Please check your connection or try a simpler question.`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsAnswering(false);
    }
  };

  // Read answer aloud with Timbre v2.5
  const handleReadAnswerAloud = async (messageId: string, answerText: string) => {
    setReadingAnswerId(messageId);
    showToast('Speaking answer with Gnani Timbre v2.5...', 'info');

    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: answerText,
          language: book.language,
          speed: 1.0,
        }),
      });

      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && (contentType.includes('audio') || contentType.includes('octet-stream'))) {
        const blob = await resp.blob();
        const audioUrl = URL.createObjectURL(blob);
        const tempAudio = new Audio(audioUrl);
        tempAudio.onended = () => setReadingAnswerId(null);
        await tempAudio.play();
      } else {
        // Fallback to browser SpeechSynthesis
        if (typeof window !== 'undefined' && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(answerText);
          utterance.onend = () => setReadingAnswerId(null);
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch {
      showToast('Could not play audio answer.', 'error');
      setReadingAnswerId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl h-[85vh] rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0 bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[var(--text-primary)] font-ui">
                  Ask the Book
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Prisma STT + Evon v3.3
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)] truncate max-w-sm">
                Strictly grounded in "{book.title}" (RAG with 128K context)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Messages Scroll Area */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-6 space-y-5">
          {messages.length === 0 ? (
            <div className="py-6 text-center max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                Have a question about the book?
              </h4>
              <p className="text-xs text-[var(--text-secondary)] font-reading leading-relaxed mb-6">
                Tap the big microphone below and speak naturally in English, Hindi, or Hinglish. Evon searches through the book chunks and answers strictly with citations.
              </p>

              {/* Sample Quick Questions */}
              <div className="space-y-2 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Try asking:
                </p>
                {suggestedQuestions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAskQuestion(q)}
                    className="w-full p-2.5 rounded-xl border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] hover:border-blue-500/40 hover:bg-[var(--bg-surface-elevated)] transition flex items-center justify-between group"
                  >
                    <span>"{q}"</span>
                    <ArrowRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white font-medium rounded-br-sm shadow-md'
                      : 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-sm font-reading'
                  }`}
                >
                  <p className="whitespace-pre-line">{msg.text}</p>

                  {/* Citations / Source Sections */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]/60 text-xs">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-blue-500 mb-1.5 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Source Excerpts:
                      </p>
                      <div className="space-y-1.5">
                        {msg.citations.map((c, cIdx) => (
                          <div
                            key={cIdx}
                            className="p-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-2"
                          >
                            <div className="truncate">
                              <span className="font-bold text-[11px] text-[var(--text-primary)] block truncate">
                                {c.sectionTitle}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] italic line-clamp-1">
                                {c.relevantExcerpt}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                onJumpToSection(c.sectionId);
                                onClose();
                              }}
                              className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition shrink-0 flex items-center gap-1"
                            >
                              <span>Jump</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Read Aloud Button for Evon Answers */}
                  {msg.sender === 'evon' && (
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => handleReadAnswerAloud(msg.id, msg.text)}
                        disabled={readingAnswerId === msg.id}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition flex items-center gap-1.5"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>
                          {readingAnswerId === msg.id ? 'Reading Answer...' : 'Read Aloud (Timbre)'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isAnswering && (
            <div className="flex items-start gap-2">
              <div className="p-4 rounded-3xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center gap-3 text-xs text-[var(--text-muted)]">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span>Evon v3.3 is reading the relevant book chunks...</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Mic Button & Text Fallback */}
        <div className="p-4 sm:p-5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
          {/* Big Voice Mic Centerpiece */}
          <div className="flex flex-col items-center justify-center mb-4">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-16 h-16 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 relative group active:scale-95 ${
                isRecording
                  ? 'bg-rose-600 text-white ring-8 ring-rose-500/20 animate-pulse'
                  : 'bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
              }`}
              title={isRecording ? 'Tap to stop recording' : 'Tap to speak question'}
            >
              {isRecording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-7 h-7" />}
              {isRecording && (
                <span className="absolute -bottom-6 text-[10px] font-bold text-rose-500 whitespace-nowrap">
                  Listening (Tap to send)
                </span>
              )}
            </button>
            {!isRecording && (
              <span className="text-[11px] text-[var(--text-muted)] mt-2">
                Tap to speak question (Prisma STT • Hindi / English / Hinglish)
              </span>
            )}
          </div>

          {/* Text Input Fallback (for noisy rooms or mic blocked) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAskQuestion(inputText);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Or type a question about this book..."
              className="flex-1 px-4 py-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isAnswering}
              className="p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition shrink-0 shadow-md"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
