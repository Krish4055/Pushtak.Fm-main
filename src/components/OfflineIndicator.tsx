import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-full bg-amber-600/95 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-white shadow-xl animate-fade-in border border-amber-400/30">
      <WifiOff className="w-3.5 h-3.5 animate-pulse" />
      <span>Offline Mode — Using Cached Audio & Books</span>
    </div>
  );
};
