import React from 'react';
import { Shield, Sparkles, Keyboard, Heart } from 'lucide-react';

export const Footer: React.FC<{ onOpenPrivacy: () => void }> = ({ onOpenPrivacy }) => {
  return (
    <footer className="w-full border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-10 px-4 sm:px-6 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-[var(--text-muted)]">
        {/* Left: Privacy line */}
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Shield className="w-3.5 h-3.5" />
          </div>
          <p className="font-medium text-[var(--text-secondary)]">
            Your books stay on your device/account and are never shared.{' '}
            <button
              onClick={onOpenPrivacy}
              className="text-blue-500 hover:underline font-semibold ml-1"
            >
              Learn more & data privacy
            </button>
          </p>
        </div>

        {/* Center: Models line */}
        <div className="flex items-center gap-2 text-[11px]">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>Powered by Gnani AI:</span>
          <span className="font-semibold text-[var(--text-primary)]">Timbre v2.5 (TTS)</span>
          <span>•</span>
          <span className="font-semibold text-[var(--text-primary)]">Prisma v2.5 (STT)</span>
          <span>•</span>
          <span className="font-semibold text-[var(--text-primary)]">Evon v3.3 (128K LLM)</span>
        </div>

        {/* Right: Keyboard Shortcuts summary */}
        <div className="hidden lg:flex items-center gap-3 font-mono text-[10px]">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
              Space
            </kbd>{' '}
            Play/Pause
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
              ← / →
            </kbd>{' '}
            15s
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]">
              M
            </kbd>{' '}
            Mic
          </span>
        </div>
      </div>
    </footer>
  );
};
