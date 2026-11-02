import React, { useState } from 'react';
import { Headphones, Clock, Sparkles, ArrowRight, Check } from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const slides = [
    {
      icon: Headphones,
      title: 'Listen to Anything, Hands-Free',
      subtitle: 'Natural Voice for Students & Commuters',
      description:
        'Upload any 500-page book, PDF, DOCX, or pasted text. Pushtak.fm reads it aloud in natural Indian & global voices with Timbre v2.5.',
      badge: 'Gnani Timbre v2.5 TTS',
      color: 'from-blue-600 to-indigo-600',
    },
    {
      icon: Clock,
      title: 'Smart Commute Sections',
      subtitle: 'Never Cut Mid-Sentence',
      description:
        'Pushtak intelligently splits massive books into 5, 10, or 20-minute listening bites matched to your train, bus, or study break.',
      badge: 'Listening-Time Segmentation',
      color: 'from-amber-600 to-rose-600',
    },
    {
      icon: Sparkles,
      title: 'Ask the Book & Student Mode',
      subtitle: 'Voice Q&A, Quizzes & Flashcards',
      description:
        'Tap the mic to ask questions in Hindi, English, or Hinglish with Prisma STT. Get grounded answers from Evon v3.3 and test yourself with spaced repetition.',
      badge: 'Prisma STT + Evon v3.3 LLM',
      color: 'from-emerald-600 to-teal-600',
    },
  ];

  const currentSlide = slides[step];
  const Icon = currentSlide.icon;

  const handleNext = () => {
    if (step < slides.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-7 shadow-2xl overflow-hidden relative animate-scale-up">
        {/* Step Indicators */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <div
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === step ? 'w-8 bg-blue-600' : 'w-2 bg-neutral-200 dark:bg-neutral-800'
                }`}
              />
            ))}
          </div>
          <button
            onClick={onClose}
            className="text-xs font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition"
          >
            Skip
          </button>
        </div>

        {/* Visual Icon Badge */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`w-20 h-20 rounded-3xl bg-gradient-to-tr ${currentSlide.color} text-white flex items-center justify-center shadow-lg mb-6`}
          >
            <Icon className="w-10 h-10" />
          </div>

          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mb-3 border border-blue-200/50 dark:border-blue-900/50">
            {currentSlide.badge}
          </span>

          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-1.5">
            {currentSlide.title}
          </h2>
          <p className="text-xs font-medium text-neutral-500 mb-4">{currentSlide.subtitle}</p>

          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mb-8">
            {currentSlide.description}
          </p>
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-sm font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition"
          >
            <span>{step === slides.length - 1 ? 'Start Listening' : 'Continue'}</span>
            {step === slides.length - 1 ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
