import React, { useState, useEffect } from 'react';
import { Cloud, RefreshCw } from 'lucide-react';

interface GoogleDriveStatusBadgeProps {
  onOpenSyncModal: () => void;
  className?: string;
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
}) => {
  const [driveStatus, setDriveStatus] = useState<{
    isConnected: boolean;
    isConfigured?: boolean;
    lastBackupAt?: string | null;
    lastFileName?: string | null;
  }>({ isConnected: false });

  const [loading, setLoading] = useState(false);

  const fetchStatus = async () => {
    if (!window.api?.gdrive) return;
    try {
      const res = await window.api.gdrive.status();
      setDriveStatus(res);
    } catch (err) {
      console.warn('Failed to fetch GDrive status for badge:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh status every 30 seconds
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = driveStatus.isConnected;
  const timeAgo = formatTimeAgo(driveStatus.lastBackupAt);

  const tooltipText = isConnected
    ? driveStatus.lastBackupAt
      ? `Google Drive: Last updated ${new Date(driveStatus.lastBackupAt).toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}${driveStatus.lastFileName ? ` (${driveStatus.lastFileName})` : ''}. Click to manage backups.`
      : 'Google Drive connected. No backup created yet. Click to backup now.'
    : 'Google Drive disconnected. Click to connect your account.';

  return (
    <button
      type="button"
      onClick={onOpenSyncModal}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-ui-xs font-semibold font-mono transition-all border shadow-2xs hover:shadow-xs cursor-pointer select-none ${
        isConnected
          ? 'bg-azure-mist-50/90 hover:bg-azure-mist-100 text-azure-mist-900 border-azure-mist-300'
          : 'bg-jungle-teal-100/60 hover:bg-jungle-teal-100 text-jungle-teal-700 border-jungle-teal-200'
      } ${className}`}
      title={tooltipText}
    >
      <span
        className={`w-2 h-2 rounded-full shrink-0 ${
          isConnected
            ? 'bg-emerald-500 animate-pulse ring-2 ring-emerald-200'
            : 'bg-jungle-teal-400'
        }`}
      />
      <Cloud className={`w-3.5 h-3.5 shrink-0 ${isConnected ? 'text-azure-mist-700' : 'text-jungle-teal-500'}`} />
      <span className="truncate">
        Drive: {isConnected ? timeAgo : 'Offline'}
      </span>
    </button>
  );
};
