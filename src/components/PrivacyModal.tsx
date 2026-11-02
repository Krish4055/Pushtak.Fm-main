import React, { useState } from 'react';
import { Shield, Trash2, X, Lock, HardDrive, CheckCircle2 } from 'lucide-react';
import { clearAllUserData } from '../services/db';
import { useToast } from './Toast';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataCleared: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose, onDataCleared }) => {
  const { showToast } = useToast();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDeleteAll = async () => {
    setIsDeleting(true);
    try {
      await clearAllUserData();
      showToast('All your books, audio cache, and notes have been deleted from your device.', 'success');
      onDataCleared();
      onClose();
    } catch {
      showToast('Failed to clear data.', 'error');
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-2xl overflow-hidden animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white">Privacy & Local Storage</h3>
              <p className="text-xs text-neutral-500">Your books stay on your device</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-4 text-sm text-neutral-600 dark:text-neutral-300">
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800">
            <Lock className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider mb-1">
                Zero Cloud Data Retention
              </p>
              <p className="text-xs leading-relaxed">
                Your uploaded books, text documents, reading progress, and audio files are stored solely in your local browser’s IndexedDB database. They are never sold, indexed, or shared with third parties.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-800">
            <HardDrive className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-neutral-900 dark:text-white text-xs uppercase tracking-wider mb-1">
                Local Audio Caching & Privacy
              </p>
              <p className="text-xs leading-relaxed">
                Generated audio is hashed and cached locally so you can listen offline and avoid burning unnecessary API credits. You have complete autonomy to wipe your local cache anytime.
              </p>
            </div>
          </div>

          {/* Model Disclosure */}
          <div className="p-3.5 rounded-xl bg-neutral-100/70 dark:bg-neutral-800/30 text-xs">
            <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              Gnani AI Architecture
            </p>
            <p className="text-neutral-500 dark:text-neutral-400 leading-relaxed">
              When requesting speech synthesis (Timbre v2.5), speech recognition (Prisma v2.5), or book Q&A (Evon v3.3), text chunks are processed through server proxies and never stored after fulfillment.
            </p>
          </div>
        </div>

        {/* Danger Zone: Delete My Data */}
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800">
          {!confirmingDelete ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">Local Data Management</p>
                <p className="text-[11px] text-neutral-500">Purge all books, audio cache, and reading progress</p>
              </div>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 transition flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete My Data
              </button>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
              <p className="text-xs font-bold text-rose-700 dark:text-rose-300 mb-1">
                Are you sure? This cannot be undone.
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mb-3">
                All books, audio cache, and saved progress in this browser will be permanently deleted.
              </p>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={isDeleting}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition flex items-center gap-1.5"
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Everything'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
