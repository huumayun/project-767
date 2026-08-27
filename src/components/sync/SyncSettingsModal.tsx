import React, { useState, useEffect } from 'react';
import { UserSession, SyncStatusInfo, BackupFileInfo } from '../../types/ipc';
import {
  Cloud,
  HardDrive,
  RefreshCw,
  Save,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Clock,
  Database,
  ShieldAlert,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { ConfirmModal } from '../common/ConfirmModal';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: UserSession | null;
}

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
  isOpen,
  onClose,
  currentSession,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'sync' | 'backup'>('sync');

  // Supabase Config
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState('');
  const [shopId, setShopId] = useState('');

  // Sync Info
  const [syncInfo, setSyncInfo] = useState<SyncStatusInfo | null>(null);
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);

  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Restore Confirm Modal
  const [restoreTargetFile, setRestoreTargetFile] = useState<BackupFileInfo | null>(null);

  const isOwner = currentSession?.role === 'owner';

  const loadData = async () => {
    if (!window.api || !isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const [status, settings, backupList] = await Promise.all([
        isOwner ? window.api.sync.getStatus().catch(() => null) : Promise.resolve(null),
        window.api.settings.get(),
        isOwner ? window.api.backup.list() : Promise.resolve([]),
      ]);

      if (status) setSyncInfo(status);
      setSupabaseUrl(settings.supabase_url || '');
      setSupabaseAnonKey(settings.supabase_anon_key ? '••••••••' : '');
      setShopId(settings.shop_id || '');
      setBackups(backupList);
    } catch (err: any) {
      console.warn('Failed to fetch sync settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, isOwner]);

  if (!isOpen) return null;

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api || !isOwner) return;

    setLoading(true);
    setError(null);
    try {
      await window.api.sync.configure({
        supabase_url: supabaseUrl.trim(),
        supabase_anon_key: supabaseAnonKey.trim(),
        shop_id: shopId.trim(),
      });
      toast.success('Cloud credentials and Sync configuration updated!');
      setSuccessMsg('Cloud credentials encrypted and saved successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save configuration.');
      setError(err.message || 'Failed to save configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = async () => {
    if (!window.api || !isOwner) return;
    setSyncing(true);
    setError(null);
    try {
      const res = await window.api.sync.triggerSync();
      toast.success(`Sync completed! ${res.uploaded} uploaded, ${res.downloaded} downloaded.`);
      setSuccessMsg(`Sync complete! Uploaded ${res.uploaded}, Downloaded ${res.downloaded} records.`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadData();
    } catch (err: any) {
      toast.error(`Sync error: ${err.message}`);
      setError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateBackup = async () => {
    if (!window.api || !isOwner) return;
    try {
      const backup = await window.api.backup.createManual();
      toast.success(`Database backup created: ${backup.fileName}`);
      setSuccessMsg(`Database backup created: ${backup.fileName}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create backup.');
      setError(err.message || 'Failed to create backup.');
    }
  };

  const confirmRestoreBackup = async () => {
    if (!restoreTargetFile || !window.api || !isOwner) return;

    try {
      await window.api.backup.restore(restoreTargetFile.filePath);
      toast.success('Database restored successfully! Refreshing terminal...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error(`Restore failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <ConfirmModal
        isOpen={!!restoreTargetFile}
        onClose={() => setRestoreTargetFile(null)}
        onConfirm={confirmRestoreBackup}
        title="Restore Database"
        message={`Are you sure you want to restore from ${restoreTargetFile?.fileName}? Current data will be replaced.`}
      />
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shadow-xs">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-jungle-teal-900">Cloud Sync & Local Backup Center</h3>
              <p className="text-xs text-jungle-teal-500 font-mono">Offline-First SQLite WAL · Supabase Cloud Delta Engine</p>
            </div>
          </div>

          <button onClick={onClose} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 bg-jungle-teal-100 p-1 rounded-xl border border-jungle-teal-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'sync'
                ? 'bg-azure-mist-700 text-white font-bold shadow-xs'
                : 'text-jungle-teal-600 hover:text-jungle-teal-900 hover:bg-jungle-teal-50'
            }`}
          >
            <Cloud className="w-4 h-4" />
            Supabase Cloud Sync
          </button>

          <button
            onClick={() => setActiveTab('backup')}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all ${
              activeTab === 'backup'
                ? 'bg-muted-teal-700 text-white font-bold shadow-xs'
                : 'text-jungle-teal-600 hover:text-jungle-teal-900 hover:bg-jungle-teal-50'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Local Database Backups
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-muted-teal-50 border border-muted-teal-200 rounded-xl text-muted-teal-900 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1. CLOUD SYNC TAB */}
        {activeTab === 'sync' && (
          <div className="space-y-4 text-xs">
            {/* Live Sync Status Card */}
            <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-xl space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-jungle-teal-600 font-sans font-semibold">Current Sync Engine Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                    syncInfo?.status === 'synced'
                      ? 'bg-muted-teal-100 text-muted-teal-900 border border-muted-teal-300'
                      : syncInfo?.status === 'pending'
                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                      : syncInfo?.status === 'syncing'
                      ? 'bg-azure-mist-100 text-azure-mist-900 border border-azure-mist-300'
                      : 'bg-jungle-teal-200 text-jungle-teal-700'
                  }`}
                >
                  {syncInfo?.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-[11px] text-jungle-teal-700">
                <div>
                  <span className="text-jungle-teal-500 block">Pending Local Changes:</span>
                  <span className="text-sm font-bold text-azure-mist-800">{syncInfo?.pendingCount || 0} records</span>
                </div>
                <div>
                  <span className="text-jungle-teal-500 block">Last Cloud Sync:</span>
                  <span className="text-jungle-teal-900 font-semibold">
                    {syncInfo?.lastSyncedAt ? new Date(syncInfo.lastSyncedAt).toLocaleString() : 'Never'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  disabled={syncing || !syncInfo?.cloudConfigured}
                  onClick={handleTriggerSync}
                  className="px-4 py-2 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 font-sans shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing Now...' : 'Trigger Sync Now'}
                </button>
              </div>
            </div>

            {/* Supabase Config Form (Owner Only) */}
            <form onSubmit={handleSaveConfig} className="space-y-3 pt-2">
              <h4 className="font-bold text-jungle-teal-800 flex items-center gap-1.5">
                <Cloud className="w-4 h-4 text-azure-mist-700" />
                Supabase Project Connection Credentials
              </h4>

              <div>
                <label className="block text-jungle-teal-600 font-semibold mb-1">Supabase Project URL</label>
                <input
                  type="url"
                  required
                  disabled={!isOwner}
                  value={supabaseUrl}
                  onChange={(e) => setSupabaseUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-jungle-teal-600 font-semibold mb-1">Supabase Anon Key (Public Key)</label>
                <input
                  type="password"
                  required
                  disabled={!isOwner}
                  value={supabaseAnonKey}
                  onChange={(e) => setSupabaseAnonKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 disabled:opacity-60"
                />
                <span className="text-[10px] text-jungle-teal-500 mt-1 block">
                  Encrypted securely in Windows DPAPI / macOS Keychain via Electron safeStorage.
                </span>
              </div>

              <div>
                <label className="block text-jungle-teal-600 font-semibold mb-1">Shop Identifier (UUID)</label>
                <input
                  type="text"
                  required
                  disabled={!isOwner}
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 disabled:opacity-60"
                />
              </div>

              {isOwner && (
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save & Encrypt Credentials
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {/* 2. LOCAL BACKUPS TAB */}
        {activeTab === 'backup' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-bold text-jungle-teal-800">Automated Daily Backups (14-Day Retention)</h4>
                <p className="text-jungle-teal-500 text-[11px]">
                  Atomic SQLite snapshots created via VACUUM INTO command in application storage.
                </p>
              </div>

              {isOwner && (
                <button
                  type="button"
                  onClick={handleCreateBackup}
                  className="px-4 py-2 bg-muted-teal-700 hover:bg-muted-teal-600 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md transition-colors"
                >
                  <Database className="w-4 h-4" />
                  Backup Database Now
                </button>
              )}
            </div>

            {/* Backups List */}
            <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-jungle-teal-100 text-jungle-teal-600 font-mono text-[10px] uppercase border-b border-jungle-teal-200">
                  <tr>
                    <th className="p-3">File Name</th>
                    <th className="p-3">Size</th>
                    <th className="p-3">Created</th>
                    {isOwner && <th className="p-3 text-center">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-jungle-teal-200 font-mono text-[11px]">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-jungle-teal-500 font-sans">
                        No local backup files created yet.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.fileName} className="hover:bg-jungle-teal-50 transition-colors">
                        <td className="p-3 text-jungle-teal-900 font-semibold">
                          <div className="flex items-center gap-1.5">
                            <Database className="w-3.5 h-3.5 text-azure-mist-700" />
                            <span>{b.fileName}</span>
                            {b.isAutomatic && (
                              <span className="px-1.5 py-0.2 bg-jungle-teal-200 text-jungle-teal-600 rounded-sm text-[9px]">
                                auto
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-jungle-teal-600">{(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB</td>
                        <td className="p-3 text-jungle-teal-600">{new Date(b.createdAt).toLocaleString()}</td>
                        {isOwner && (
                          <td className="p-3 text-center">
                            <button
                              onClick={() => setRestoreTargetFile(b)}
                              className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-300 font-sans font-bold text-[10px] transition-colors"
                            >
                              Restore
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={Boolean(restoreTargetFile)}
        onCancel={() => setRestoreTargetFile(null)}
        onConfirm={confirmRestoreBackup}
        isDanger
        confirmLabel="Restore Database"
        title="Restore Database from Backup"
        message={`Are you sure you want to restore from ${restoreTargetFile?.fileName}? A safety snapshot will be created before overwriting the current database.`}
      />
    </div>
  );
};
