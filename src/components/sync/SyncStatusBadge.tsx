import React, { useState, useEffect } from 'react';
import { SyncStatusInfo } from '../../types/ipc';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SyncStatusBadgeProps {
  onOpenSyncModal: () => void;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({ onOpenSyncModal }) => {
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo>({
    status: 'offline',
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
    cloudConfigured: false,
  });

  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    if (!window.api?.sync) return;
    try {
      const [info, gdrive] = await Promise.all([
        window.api.sync.getStatus(),
        window.api.gdrive ? window.api.gdrive.status() : Promise.resolve({ isConnected: false })
      ]);
      setSyncInfo(info);
      setGdriveConnected(gdrive.isConnected);
    } catch (err) {
      console.error('Failed to get sync status:', err);
    }
  };

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 10000); // refresh every 10s
    return () => clearInterval(timer);
  }, []);

  const handleManualSync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.api?.sync || loading) return;
    setLoading(true);
    try {
      const info = await window.api.sync.triggerNow();
      setSyncInfo(info);
    } catch (err) {
      console.error('Manual sync failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = () => {
    if (!syncInfo.cloudConfigured) {
      if (gdriveConnected) {
        return (
          <button
            onClick={onOpenSyncModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 border border-green-300 text-green-700 hover:bg-green-200 text-xs font-mono transition-colors"
            title="Google Drive backup is active."
          >
            <Cloud className="w-3.5 h-3.5 text-green-600" />
            <span className="font-bold">Cloud Backup Enabled</span>
          </button>
        );
      }
      return (
        <button
          onClick={onOpenSyncModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-jungle-teal-100 border border-jungle-teal-300 text-jungle-teal-600 hover:text-jungle-teal-900 hover:bg-jungle-teal-200 text-xs font-mono transition-colors"
          title="Cloud backup not configured. Click to setup."
        >
          <CloudOff className="w-3.5 h-3.5 text-jungle-teal-500" />
          <span>Local Only</span>
        </button>
      );
    }

    if (syncInfo.status === 'syncing' || loading) {
      return (
        <button
          onClick={onOpenSyncModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-300 text-amber-800 text-xs font-mono transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600" />
          <span>Syncing...</span>
        </button>
      );
    }

    if (syncInfo.status === 'pending' || syncInfo.pendingCount > 0) {
      return (
        <button
          onClick={onOpenSyncModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-azure-mist-50 border border-azure-mist-300 text-azure-mist-900 text-xs font-mono transition-colors"
          title={`${syncInfo.pendingCount} local changes pending cloud upload.`}
        >
          <Cloud className="w-3.5 h-3.5 text-azure-mist-700" />
          <span>Pending ({syncInfo.pendingCount})</span>
          <span
            onClick={handleManualSync}
            className="text-azure-mist-700 hover:text-azure-mist-950 ml-0.5 cursor-pointer"
            title="Trigger Sync Now"
          >
            <RefreshCw className="w-3 h-3" />
          </span>
        </button>
      );
    }

    if (syncInfo.status === 'error') {
      return (
        <button
          onClick={onOpenSyncModal}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-300 text-rose-800 text-xs font-mono transition-colors"
          title={syncInfo.lastError || 'Sync failed'}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>Sync Error</span>
        </button>
      );
    }

    return (
      <button
        onClick={onOpenSyncModal}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted-teal-50 border border-muted-teal-300 text-muted-teal-900 text-xs font-mono font-bold transition-colors"
        title="All local data backed up to cloud."
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-muted-teal-700" />
        <span>Synced</span>
      </button>
    );
  };

  return <>{renderBadge()}</>;
};
