import React from 'react';
import { Home, BookOpen, Mic, GraduationCap, Settings } from 'lucide-react';

export type NavTab = 'home' | 'library' | 'ask' | 'study';

interface NavigationProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onOpenSettings?: () => void;
  hasActiveBook?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onTabChange,
  onOpenSettings,
}) => {
  const tabs = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'library' as NavTab, label: 'Library', icon: BookOpen },
    { id: 'ask' as NavTab, label: 'Ask', icon: Mic },
    { id: 'study' as NavTab, label: 'Study', icon: GraduationCap },
  ];

  return (
    <>
      {/* Desktop Left Sidebar: Full height, sticky, scrollable if window is short, no cutoff */}
      <aside
        className="hidden md:flex flex-col justify-between w-64 border-r border-[var(--border-subtle)] bg-[var(--bg-app)] p-5 fixed left-0 top-0 bottom-0 h-screen z-30 select-none overflow-y-auto"
        aria-label="Desktop Sidebar"
      >
        <div className="flex flex-col">
          {/* Logo (Desktop ONLY - removed from top bar) */}
          <div className="px-3 py-3 mb-6">
            <h1 className="font-serif-heading font-bold text-2xl tracking-tight text-[var(--text-primary)]">
              Pushtak<span className="text-[#C2562F]">.fm</span>
            </h1>
            <p className="text-sm text-[var(--text-secondary)] font-ui mt-0.5">
              Listen to any book
            </p>
          </div>

          {/* Main Navigation Tabs */}
          <nav className="space-y-1.5" aria-label="Main Navigation">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-base font-medium transition-colors min-h-[48px] tap-target text-left ${
                    isActive
                      ? 'bg-[var(--bg-surface)] text-[#C2562F] font-semibold border border-[var(--border-subtle)] shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom of Sidebar: Settings & Gnani AI attribution */}
        <div className="pt-4 mt-auto border-t border-[var(--border-subtle)] space-y-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="w-full flex items-center gap-3.5 px-4 py-3 rounded-xl text-base font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-soft)] transition-colors min-h-[48px] tap-target text-left"
              aria-label="Open Settings"
            >
              <Settings className="w-5 h-5 shrink-0" />
              <span>Settings</span>
            </button>
          )}

          <div className="px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">Gnani AI Speech & LLM</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Timbre • Prisma • Evon</p>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar (390px mobile-first, 48px tap targets, safe-area padding) */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-center justify-around select-none"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 min-h-[48px] tap-target rounded-lg transition-colors ${
                isActive
                  ? 'text-[#C2562F] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-5 h-5 mb-0.5 shrink-0" />
              <span className="text-xs font-ui leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
