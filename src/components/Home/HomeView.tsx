import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Clock,
  Car,
  GraduationCap,
  Play,
  BookOpen,
  ArrowRight,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { ParsedBook, BookProgress } from '../../types';
import { saveBook } from '../../services/db';
import { useToast } from '../Toast';

interface HomeViewProps {
  onBookLoaded: (book: ParsedBook) => void;
  continueBook: ParsedBook | null;
  continueProgress?: BookProgress;
  onResume: (book: ParsedBook, sectionIndex: number, sentenceIndex: number) => void;
  onOpenCommute: () => void;
  onOpenStudy: () => void;
  onOpenDemo: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onBookLoaded,
  continueBook,
  continueProgress,
  onResume,
  onOpenCommute,
  onOpenStudy,
  onOpenDemo,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStage, setProgressStage] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Extracted raw data waiting for section length choice
  const [extractedData, setExtractedData] = useState<{
    title: string;
    text: string;
    author: string;
  } | null>(null);

  const [selectedMinutes, setSelectedMinutes] = useState<number>(10);

  // Paste Text modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedContent, setPastedContent] = useState('');

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (file: File) => {
    setErrorMessage(null);
    setIsProcessing(true);
    setProgressPercent(30);
    setProgressStage(`Reading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetMinutes', '10');

      setProgressPercent(60);
      setProgressStage('Extracting text and chapters...');

      const resp = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(err.error || 'Could not parse document.');
      }

      const book: ParsedBook = await resp.json();

      setProgressPercent(100);
      setExtractedData({
        title: book.title,
        text: book.chapters.map((c) => c.sections.map((s) => s.text).join('\n\n')).join('\n\n') || '',
        author: book.author || 'Uploaded File',
      });
      setIsProcessing(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not parse document.');
      showToast(err.message || 'File upload error', 'error');
      setIsProcessing(false);
    }
  };

  const handleConfirmSectionLength = async () => {
    if (!extractedData) return;
    setIsProcessing(true);
    setProgressStage(`Preparing ${selectedMinutes}-minute sections...`);
    setProgressPercent(70);

    try {
      const resp = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: extractedData.title,
          text: extractedData.text,
          targetMinutes: selectedMinutes,
          author: extractedData.author,
        }),
      });

      if (!resp.ok) throw new Error('Failed to create sections.');

      const finalBook: ParsedBook = await resp.json();
      await saveBook(finalBook);
      showToast(`Ready! "${finalBook.title}" split into ${finalBook.sections.length} sections.`, 'success');

      setIsProcessing(false);
      setExtractedData(null);
      onBookLoaded(finalBook);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not finish sections.');
      setIsProcessing(false);
    }
  };

  const handleProcessPastedText = async () => {
    if (!pastedContent.trim()) {
      showToast('Please paste some text first.', 'error');
      return;
    }
    setShowPasteModal(false);
    setExtractedData({
      title: pastedTitle.trim() || 'Pasted Notes',
      text: pastedContent,
      author: 'Pasted Document',
    });
  };

  // Section remaining estimation
  const continueCurrentSection =
    continueBook && continueProgress
      ? continueBook.sections[continueProgress.currentSectionIndex] || continueBook.sections[0]
      : null;
  const continueSectionsLeft =
    continueBook && continueProgress
      ? Math.max(0, continueBook.sections.length - continueProgress.currentSectionIndex)
      : 0;
  const continueMinutesLeft = continueSectionsLeft * (continueBook?.targetMinutesPerSection || 10);

  return (
    <div className="w-full max-w-xl mx-auto px-4 sm:px-6 py-6 pb-28 space-y-8">
      {/* 1. Short Greeting & One-Line Promise */}
      <div className="pt-2">
        <h2 className="font-serif-heading text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text-primary)]">
          Listen to any book, PDF or notes.
        </h2>
        <p className="text-base text-[var(--text-secondary)] font-ui mt-2">
          Turn reading into calm, hands-free listening with natural voices.
        </p>
      </div>

      {/* 2. Large Upload Card with Dashed Border (THE ONLY PRIMARY ACTION) */}
      {!extractedData ? (
        <div className="space-y-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept=".pdf,.docx,.txt,.epub,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
          />

          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-colors ${
              isDragging
                ? 'border-[#C2562F] bg-[#FAEDE7]'
                : 'border-[var(--border-strong)] bg-[var(--bg-surface)]'
            }`}
          >
            <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface-soft)] text-[#C2562F] flex items-center justify-center mx-auto mb-4 border border-[var(--border-subtle)]">
              <UploadCloud className="w-6 h-6" />
            </div>

            <p className="font-serif-heading text-lg font-bold text-[var(--text-primary)] mb-1">
              Drop a PDF, DOCX, EPUB or TXT here
            </p>
            <p className="text-sm text-[var(--text-secondary)] font-ui mb-5">
              or choose a document from your device
            </p>

            {/* Clear Primary Action Button */}
            <button
              type="button"
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              disabled={isProcessing}
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white text-base font-medium transition tap-target"
            >
              Choose a file
            </button>

            {/* Paste text link */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowPasteModal(true)}
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[#C2562F] underline underline-offset-4"
              >
                Paste text instead
              </button>
            </div>
          </div>

          {/* Simple Skeleton / Progress Indicator */}
          {isProcessing && (
            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-sm text-[var(--text-primary)]">
                <span>{progressStage}</span>
                <span className="font-mono text-xs">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--bg-surface-soft)] overflow-hidden">
                <div
                  className="h-full bg-[#C2562F] transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message with clear Retry button */}
          {errorMessage && (
            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[#C2562F]/40 flex items-center justify-between text-sm text-[var(--text-primary)]">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-[#C2562F] shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)]"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      ) : (
        /* 3. Section Length Selector (5 / 10 / 20 min) Cards */
        <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-5">
          <div>
            <h3 className="font-serif-heading text-xl font-bold text-[var(--text-primary)]">
              Choose section length for "{extractedData.title}"
            </h3>
            <p className="text-sm text-[var(--text-secondary)] font-ui mt-1">
              Sections are cleanly split on sentence ends so reading is never cut off.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { minutes: 5, label: '5 min', desc: 'Short commutes (~700 words)' },
              { minutes: 10, label: '10 min', desc: 'Default: Recommended (~1,400 words)', isDefault: true },
              { minutes: 20, label: '20 min', desc: 'Deep reading (~2,800 words)' },
            ].map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => setSelectedMinutes(opt.minutes)}
                className={`p-4 rounded-xl border text-left transition ${
                  selectedMinutes === opt.minutes
                    ? 'border-[#C2562F] bg-[#FAEDE7] font-semibold'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-soft)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-serif-heading font-bold text-base text-[var(--text-primary)]">
                    {opt.label}
                  </span>
                  {selectedMinutes === opt.minutes && (
                    <span className="w-2 h-2 rounded-full bg-[#C2562F]" />
                  )}
                </div>
                <p className="text-xs text-[var(--text-secondary)] font-ui">{opt.desc}</p>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setExtractedData(null)}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4"
            >
              Cancel
            </button>

            <button
              onClick={handleConfirmSectionLength}
              disabled={isProcessing}
              className="px-6 py-3 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white text-base font-medium transition tap-target"
            >
              {isProcessing ? 'Preparing...' : 'Start reading'}
            </button>
          </div>
        </div>
      )}

      {/* 4. "Continue Listening" Card (Only if a book is in progress) */}
      {continueBook && continueProgress && (
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-xs font-semibold text-[#C2562F] uppercase tracking-wider block mb-0.5">
              Continue listening
            </span>
            <h4 className="font-serif-heading font-bold text-lg text-[var(--text-primary)] truncate">
              {continueBook.title}
            </h4>
            <p className="text-sm text-[var(--text-secondary)] font-ui truncate mt-0.5">
              {continueCurrentSection?.title || 'Section 1'} • ~{continueMinutesLeft} min left
            </p>
          </div>

          <button
            onClick={() =>
              onResume(
                continueBook,
                continueProgress.currentSectionIndex,
                continueProgress.currentSentenceIndex
              )
            }
            className="w-12 h-12 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white flex items-center justify-center shrink-0 tap-target transition"
            aria-label="Resume listening"
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        </div>
      )}

      {/* 5. Two Simple Cards: Travelling and Studying, plus Sample Book text link */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* I'm travelling */}
          <button
            onClick={onOpenCommute}
            className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[#C2562F] text-left transition tap-target flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-surface-soft)] text-[#C2562F] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <p className="font-serif-heading font-bold text-base text-[var(--text-primary)]">
                I'm travelling
              </p>
              <p className="text-sm text-[var(--text-secondary)] font-ui mt-0.5">
                Large buttons for bus and train
              </p>
            </div>
          </button>

          {/* I'm studying */}
          <button
            onClick={onOpenStudy}
            className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[#C2562F] text-left transition tap-target flex items-start gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--bg-surface-soft)] text-[#5E7A5C] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <p className="font-serif-heading font-bold text-base text-[var(--text-primary)]">
                I'm studying
              </p>
              <p className="text-sm text-[var(--text-secondary)] font-ui mt-0.5">
                Quick recaps, quizzes and notes
              </p>
            </div>
          </button>
        </div>

        {/* Small sample book link */}
        <div className="text-center pt-1">
          <button
            onClick={onOpenDemo}
            className="text-sm text-[#C2562F] hover:underline font-medium"
          >
            Try a sample book
          </button>
        </div>
      </div>

      {/* 6. Footer: Small line */}
      <div className="pt-6 border-t border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
        Voices by Gnani AI.
      </div>

      {/* Paste Text Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 space-y-4">
            <h3 className="font-serif-heading font-bold text-xl text-[var(--text-primary)]">
              Paste text or notes
            </h3>
            <input
              type="text"
              value={pastedTitle}
              onChange={(e) => setPastedTitle(e.target.value)}
              placeholder="Title (e.g. Chapter 1 notes)"
              className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-base text-[var(--text-primary)] font-ui focus:outline-none focus:border-[#C2562F]"
            />
            <textarea
              rows={8}
              value={pastedContent}
              onChange={(e) => setPastedContent(e.target.value)}
              placeholder="Paste your text here..."
              className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-base text-[var(--text-primary)] font-reading focus:outline-none focus:border-[#C2562F] resize-none"
            />
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessPastedText}
                className="px-5 py-2.5 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white text-sm font-medium transition"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
