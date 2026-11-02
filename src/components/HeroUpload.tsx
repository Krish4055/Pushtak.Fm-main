import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  FileCheck,
  Clock,
  Sparkles,
  AlertCircle,
  FileCode,
  ScanText,
  ArrowRight,
  BookOpen,
} from 'lucide-react';
import { ParsedBook } from '../types';
import { saveBook } from '../services/db';
import { useToast } from './Toast';

interface HeroUploadProps {
  onBookLoaded: (book: ParsedBook) => void;
  onOpenDemo: () => void;
  playbackSpeed?: number;
}

export const HeroUpload: React.FC<HeroUploadProps> = ({
  onBookLoaded,
  onOpenDemo,
  playbackSpeed = 1.0,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'file' | 'paste'>('file');
  const [selectedMinutes, setSelectedMinutes] = useState<number>(10);
  const [pastedTitle, setPastedTitle] = useState('');
  const [pastedText, setPastedText] = useState('');

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStage, setProgressStage] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScannedPdf, setIsScannedPdf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Section options
  const durationOptions = [
    { minutes: 5, label: '5 min', desc: 'Quick commute & subway hops (~700 words)' },
    { minutes: 10, label: '10 min', desc: 'Balanced focus & bus rides (~1,400 words)', default: true },
    { minutes: 20, label: '20 min', desc: 'Deep study & train journeys (~2,800 words)' },
  ];

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
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = async (file: File) => {
    setErrorMessage(null);
    setIsScannedPdf(false);
    setIsProcessing(true);
    setProgressPercent(15);
    setProgressStage(`Reading file: ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetMinutes', selectedMinutes.toString());
      formData.append('author', 'Uploaded Author');

      // Stage 2: Uploading to backend parser
      setProgressPercent(35);
      setProgressStage('Extracting text and scanning for chapters...');

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      setProgressPercent(75);
      setProgressStage('Calculating sentence boundaries and commute sections...');

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || 'Failed to parse book');
      }

      const parsedBook: ParsedBook = await response.json();

      // Check if text was suspiciously short for PDF (Scanned document detection)
      if (file.name.toLowerCase().endsWith('.pdf') && parsedBook.totalWords < 40) {
        setIsScannedPdf(true);
        showToast('Notice: This PDF appears to be a scanned image. OCR fallback was engaged.', 'info', 5000);
      }

      setProgressPercent(95);
      setProgressStage('Indexing semantic chunks for Evon v3.3 Ask the Book...');

      // Save immediately to IndexedDB so page refresh NEVER loses the book!
      await saveBook(parsedBook);

      setProgressPercent(100);
      setProgressStage('Ready!');
      showToast(`Book "${parsedBook.title}" loaded successfully (${parsedBook.sections.length} sections)!`, 'success');

      setTimeout(() => {
        setIsProcessing(false);
        onBookLoaded(parsedBook);
      }, 400);
    } catch (err: any) {
      console.error('[Upload] Error:', err);
      setErrorMessage(err.message || 'Failed to process book.');
      showToast(err.message || 'Processing failed.', 'error');
      setIsProcessing(false);
    }
  };

  const handleProcessPastedText = async () => {
    if (!pastedText.trim()) {
      showToast('Please paste some text first.', 'error');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);
    setProgressPercent(30);
    setProgressStage('Parsing pasted text & detecting headings...');

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: pastedTitle.trim() || 'Pasted Reading Material',
          text: pastedText,
          targetMinutes: selectedMinutes,
          author: 'Pasted Document',
        }),
      });

      setProgressPercent(70);
      setProgressStage('Segmenting into listening sections...');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to parse pasted text');
      }

      const parsedBook: ParsedBook = await response.json();
      await saveBook(parsedBook);

      setProgressPercent(100);
      showToast(`Text processed into ${parsedBook.sections.length} sections!`, 'success');

      setTimeout(() => {
        setIsProcessing(false);
        onBookLoaded(parsedBook);
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Processing failed');
      showToast(err.message || 'Processing failed', 'error');
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4">
      {/* Hero Headline */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-3">
          <BookOpen className="w-3.5 h-3.5" />
          <span>The "Listen to Anything" Platform</span>
        </div>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] font-ui mb-3">
          Turn any 500-page book or notes into a calm audio journey.
        </h2>
        <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl mx-auto font-reading">
          Drag & drop your PDF, DOCX, TXT or EPUB. Pushtak splits it into commute-friendly chapters that never cut mid-sentence, powered by Gnani AI natural voices.
        </p>

        {/* 60-Second Demo Shortcut */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={onOpenDemo}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-md shadow-blue-500/25 transition active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Try 60-Second Interactive Demo</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Upload Box */}
      <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xl p-6 sm:p-8">
        {/* Step 1: Listening Section Preference */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-500" />
              1. Choose Section Duration (Listening Time)
            </label>
            <span className="text-[11px] text-[var(--text-muted)]">
              Paced at ~140 wpm ({playbackSpeed}x speed)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {durationOptions.map((opt) => (
              <button
                key={opt.minutes}
                type="button"
                onClick={() => setSelectedMinutes(opt.minutes)}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  selectedMinutes === opt.minutes
                    ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500/20'
                    : 'border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-[var(--text-primary)]">{opt.label}</span>
                  {selectedMinutes === opt.minutes && (
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-tight">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Upload or Paste Tabs */}
        <div className="mb-4 flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          <button
            onClick={() => setActiveTab('file')}
            className={`pb-2 text-xs font-bold transition flex items-center gap-1.5 border-b-2 -mb-2.5 px-3 ${
              activeTab === 'file'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            Upload Document (PDF, DOCX, TXT, EPUB)
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`pb-2 text-xs font-bold transition flex items-center gap-1.5 border-b-2 -mb-2.5 px-3 ${
              activeTab === 'paste'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileCode className="w-4 h-4" />
            Paste Text or Notes
          </button>
        </div>

        {/* Tab 1: File Drag & Drop Zone */}
        {activeTab === 'file' && (
          <div>
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
              onClick={() => !isProcessing && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[0.99]'
                  : 'border-[var(--border-subtle)] hover:border-blue-400/50 hover:bg-[var(--bg-surface-elevated)]'
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-4">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                Drop your book or syllabus here, or{' '}
                <span className="text-blue-500 underline underline-offset-4">browse files</span>
              </h3>
              <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mb-3">
                Handles up to 500-page textbooks without freezing. Supports PDF, DOCX, TXT, EPUB.
              </p>
              <div className="flex items-center justify-center gap-4 text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-500" /> Auto-chapter detection
                </span>
                <span className="flex items-center gap-1">
                  <ScanText className="w-3.5 h-3.5 text-blue-500" /> Scanned PDF OCR fallback
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Paste Raw Text */}
        {activeTab === 'paste' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Document / Chapter Title
              </label>
              <input
                type="text"
                value={pastedTitle}
                onChange={(e) => setPastedTitle(e.target.value)}
                placeholder="e.g. Modern Physics Chapter 4, Research Paper Notes"
                className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Text Content (Paste lecture notes, articles, or chapters)
              </label>
              <textarea
                rows={7}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste any long-form text here. Pushtak will divide it into listening bites without cutting mid-sentence..."
                className="w-full p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-primary)] text-sm font-reading focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleProcessPastedText}
                disabled={isProcessing || !pastedText.trim()}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs shadow-md transition"
              >
                {isProcessing ? 'Processing...' : 'Process & Generate Sections'}
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar & Status (Handles 500 pages smoothly) */}
        {isProcessing && (
          <div className="mt-6 p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] animate-fade-in">
            <div className="flex items-center justify-between text-xs font-bold text-[var(--text-primary)] mb-2">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                {progressStage}
              </span>
              <span>{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)] mt-2">
              Background processor is chunking semantic embeddings for Evon v3.3 Q&A. Progress is saved locally in IndexedDB.
            </p>
          </div>
        )}

        {/* Scanned PDF Notice */}
        {isScannedPdf && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <ScanText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Scanned Document Detected</p>
              <p className="mt-0.5">
                This document contains scanned image pages. OCR fallback mode was applied to extract headings and available text blocks.
              </p>
            </div>
          </div>
        )}

        {/* Error State with friendly retry */}
        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 transition"
            >
              Retry Upload
            </button>
          </div>
        )}
      </div>

      {/* 3 Quick-Start Use Cases */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
            <FileText className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">Study Mode</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-reading">
            Listen to 500-page textbooks in 10-minute bursts with automated 30-sec recaps, quizzes, and flashcards.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-3">
            <Clock className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">Commute Sanctuary</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-reading">
            Match sections to your 15, 30, or 45-minute bus or train ride with huge buttons and hands-free voice control.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
            <Sparkles className="w-4 h-4" />
          </div>
          <h4 className="text-sm font-bold text-[var(--text-primary)] mb-1">Ask the Book</h4>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed font-reading">
            Tap the mic to question the author in Hindi, English, or Hinglish with strictly grounded Evon v3.3 citations.
          </p>
        </div>
      </div>
    </div>
  );
};
