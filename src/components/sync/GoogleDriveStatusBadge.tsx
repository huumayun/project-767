import React, { useState, useEffect } from 'react';
import { Cloud, RefreshCw, CloudOff } from 'lucide-react';

interface GoogleDriveStatusBadgeProps {
  onOpenSyncModal: () => void;
  className?: string;
  refreshTrigger?: number;
}

function formatTimeAgo(isoString?: string | null): string {
  if (!isoString) return 'No backup yet';
  const past = new Date(isoString).getTime();
  if (isNaN(past)) return 'No backup yet';
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export const GoogleDriveStatusBadge: React.FC<GoogleDriveStatusBadgeProps> = ({
  onOpenSyncModal,
  className = '',
  refreshTrigger,
}) => {
  const [driveStatus, setDriveStatus] = useState<{
    isConnected: boolean;
    isConfigured?: boolean;
    lastBackupAt?: string | null;
    lastFileName?: string | null;
    isBackupDue?: boolean;
  }>({ isConnected: false });

  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    if (!window.api?.gdrive) return;
    setLoading(true);
    try {
      const res = await window.api.gdrive.status();
      setDriveStatus(res);
    } catch (err) {
      console.warn('Failed to fetch GDrive status for badge:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Auto-poll status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [refreshTrigger]);

  const isConnected = driveStatus.isConnected;
  const timeAgo = formatTimeAgo(driveStatus.lastBackupAt);
  const isDue = Boolean(driveStatus.isBackupDue && isConnected);

  const tooltipText = isConnected
    ? driveStatus.lastBackupAt
      ? `Google Drive: Connected. Last backup ${new Date(driveStatus.lastBackupAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}${driveStatus.lastFileName ? ` (${driveStatus.lastFileName})` : ''}.${
          isDue ? ' Over 12 hours since last backup (auto-backup due).' : ' Auto-backups trigger every 12 hours.'
        } Click to manage backups.`
      : 'Google Drive connected. No backup created yet. Auto-backup will trigger shortly. Click to backup now.'
    : 'Google Drive offline. Click to connect account for automated 12-hour cloud backups.';

  return (
    <button
      type="button"
      onClick={onOpenSyncModal}
      className={`inline-flex items-center gap-2 px-3.5 h-[40px] rounded-xl text-ui-xs font-semibold font-mono transition-all border shadow-2xs hover:shadow-xs cursor-pointer select-none active:scale-98 ${
        !isConnected
          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
          : isDue
          ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
          : 'bg-emerald-50 hover:bg-emerald-100/90 text-emerald-950 border-emerald-300'
      } ${className}`}
      title={tooltipText}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          !isConnected
            ? 'bg-slate-400'
            : isDue
            ? 'bg-amber-500 animate-pulse ring-2 ring-amber-300'
            : 'bg-emerald-500 animate-pulse ring-2 ring-emerald-300'
        }`}
      />
      
      {loading ? (
        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin text-emerald-700" />
      ) : isConnected ? (
        <Cloud className={`w-3.5 h-3.5 shrink-0 ${isDue ? 'text-amber-700' : 'text-emerald-700'}`} />
      ) : (
        <CloudOff className="w-3.5 h-3.5 shrink-0 text-slate-500" />
      )}

      <span className="truncate">
        {!isConnected
          ? 'Drive: Offline'
          : isDue
          ? `Drive: ${timeAgo} (Due)`
          : `Drive: ${timeAgo}`}
      </span>
    </button>
  );
};
