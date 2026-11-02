import React from 'react';
import { Settings } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSettings }) => {
  return (
    <header className="sticky top-0 z-30 w-full bg-[var(--bg-app)] border-b border-[var(--border-subtle)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <span className="font-serif-heading font-bold text-2xl text-[var(--text-primary)] tracking-tight">
            Pushtak<span className="text-[#C2562F]">.fm</span>
          </span>
        </div>

        {/* Right: One settings icon */}
        <button
          onClick={onOpenSettings}
          className="p-3 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)] transition tap-target flex items-center justify-center border border-transparent hover:border-[var(--border-subtle)]"
          title="Settings"
          aria-label="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};
