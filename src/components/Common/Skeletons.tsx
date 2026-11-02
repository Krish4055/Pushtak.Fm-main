import React from 'react';

export const ViewSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 bg-[var(--bg-surface-soft)] rounded-xl w-3/4" />
        <div className="h-4 bg-[var(--bg-surface-soft)] rounded-lg w-1/2" />
      </div>

      <div className="h-44 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="h-20 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl" />
        <div className="h-20 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl" />
      </div>
    </div>
  );
};

export const PlayerModalSkeleton: React.FC = () => {
  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-app)] flex flex-col items-center justify-center p-6 animate-pulse">
      <div className="w-full max-w-md space-y-6">
        <div className="h-6 bg-[var(--bg-surface-soft)] rounded-lg w-1/3 mx-auto" />
        <div className="h-64 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl" />
        <div className="space-y-2">
          <div className="h-6 bg-[var(--bg-surface-soft)] rounded-lg w-2/3 mx-auto" />
          <div className="h-4 bg-[var(--bg-surface-soft)] rounded-lg w-1/2 mx-auto" />
        </div>
        <div className="h-3 bg-[var(--bg-surface-soft)] rounded-full w-full" />
        <div className="flex justify-center gap-6">
          <div className="w-12 h-12 rounded-full bg-[var(--bg-surface-soft)]" />
          <div className="w-16 h-16 rounded-full bg-[var(--bg-surface-soft)]" />
          <div className="w-12 h-12 rounded-full bg-[var(--bg-surface-soft)]" />
        </div>
      </div>
    </div>
  );
};
