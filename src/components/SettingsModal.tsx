import React, { useState } from 'react';
import {
  X,
  Sun,
  Moon,
  BookOpen,
  Languages,
  Volume2,
  Shield,
  HelpCircle,
  Download,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { ThemeMode, SUPPORTED_LANGUAGES } from '../types';
import { clearAllUserData } from '../services/db';
import { PWAInstallButton } from './PWAInstallButton';
import { useToast } from './Toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
  currentVoiceName?: string;
  onOpenVoiceModal: () => void;
  onReplayOnboarding: () => void;
  onDataCleared: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeChange,
  currentLanguage,
  onLanguageChange,
  currentVoiceName,
  onOpenVoiceModal,
  onReplayOnboarding,
  onDataCleared,
}) => {
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const themes: { id: ThemeMode; label: string; desc: string; icon: any }[] = [
    { id: 'light', label: 'Light & Warm', desc: 'Calm paper white & deep ink', icon: Sun },
    { id: 'sepia', label: 'Sepia', desc: 'Kindle warm book tone', icon: BookOpen },
    { id: 'dark', label: 'Slate Dark', desc: 'Low glare for evening', icon: Moon },
    { id: 'amoled', label: 'AMOLED Black', desc: 'Pure black for OLED battery saving', icon: Moon },
  ];

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await clearAllUserData();
      showToast('All local books, audio cache, and progress deleted.', 'success');
      onDataCleared();
      onClose();
    } catch {
      showToast('Failed to clear data.', 'error');
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg max-h-[90vh] rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl flex flex-col overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface-elevated)] shrink-0">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">Settings</h3>
            <p className="text-xs text-[var(--text-muted)]">Preferences & Privacy</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition tap-target flex items-center justify-center"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Settings Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm">
          {/* Theme Palette */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
              Theme Palette
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {themes.map((t) => {
                const Icon = t.icon;
                const isSelected = currentTheme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onThemeChange(t.id)}
                    className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 ${
                      isSelected
                        ? 'border-[var(--accent)] bg-[#FAEDE7] dark:bg-[var(--accent)]/15 ring-2 ring-[var(--accent)]/20'
                        : 'border-[var(--border-subtle)] hover:bg-[var(--bg-surface-elevated)]'
                    }`}
                  >
                    <Icon className="w-4 h-4 text-[var(--accent)] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-bold text-xs text-[var(--text-primary)]">{t.label}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight">
                        {t.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Narrator Voice */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-[var(--accent)]" />
                Narrator Voice
              </label>
              <button
                onClick={() => {
                  onClose();
                  onOpenVoiceModal();
                }}
                className="text-xs font-bold text-[var(--accent)] hover:underline tap-target"
              >
                Change voice
              </button>
            </div>
            <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex items-center justify-between">
              <div>
                <p className="font-bold text-sm font-serif-heading text-[var(--text-primary)]">
                  {currentVoiceName || 'Lakshmi'}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5 font-ui">
                  Gnani Timbre v3.0 natural speech synthesis
                </p>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onOpenVoiceModal();
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--accent)] hover:bg-[#A94522] text-white transition tap-target"
              >
                Choose
              </button>
            </div>
          </div>

          {/* Reading & Voice Language */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3 flex items-center gap-1.5">
              <Languages className="w-4 h-4 text-[var(--accent)]" />
              Reading & Voice Language
            </label>
            <select
              value={currentLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="w-full p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-primary)] text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label} ({lang.nativeLabel})
                </option>
              ))}
            </select>
          </div>

          {/* App Tour */}
          <div className="pt-2">
            <button
              onClick={() => {
                onClose();
                onReplayOnboarding();
              }}
              className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:opacity-90 transition text-xs font-bold text-[var(--text-primary)]"
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-4 h-4 text-blue-500" />
                <span>Replay 3-Screen App Tour</span>
              </div>
              <span className="text-blue-500">View</span>
            </button>
          </div>

          {/* PWA Install */}
          <div>
            <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--text-primary)]">Install Pushtak PWA</p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Add to home screen for offline commute listening
                </p>
              </div>
              <PWAInstallButton />
            </div>
          </div>

          {/* Privacy & Danger Zone: Delete My Data */}
          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] mb-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>Privacy & Local Storage</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-4 font-reading">
              Your books, notes, and progress stay solely on this device in IndexedDB. Nothing is uploaded to public clouds.
            </p>

            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full py-2.5 px-4 rounded-xl border border-rose-300 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/20 transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete All My Data & Books</span>
              </button>
            ) : (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-800 space-y-2">
                <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
                  Are you sure? This purges all offline books and reading history.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAll}
                    disabled={isDeleting}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition"
                  >
                    {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
