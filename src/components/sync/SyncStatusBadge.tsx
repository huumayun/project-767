import React, { useState, useEffect } from 'react';
import { SyncStatusInfo } from '../../types/ipc';
import { Cloud, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

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

  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    if (!window.api?.sync) return;
    try {
      // Drive's own connection state was polled here only to label a chip that
      // is no longer drawn; Settings reports it now, so this ran every ten
      // seconds for nothing.
      setSyncInfo(await window.api.sync.getStatus());
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

  /**
   * Only states that ask something of the owner get a chip.
   *
   * "Local Only" was shown permanently on any shop without cloud backup, which
   * is the ordinary way this app runs - a badge for the default state is noise,
   * and in a 192px rail it crowded out the title beside it. Setting backup up
   * now lives in Settings, where the rest of the configuration is.
   *
   * A healthy Drive connection is likewise not news; it is reported in Settings.
   */
  const renderBadge = () => {
    if (!syncInfo.cloudConfigured) {
      return null;
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
