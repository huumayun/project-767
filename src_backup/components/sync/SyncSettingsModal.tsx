import React, { useState, useEffect } from 'react';
import { UserSession, BackupFileInfo } from '../../types/ipc';
import {
  Cloud,
  HardDrive,
  CheckCircle2,
  AlertCircle,
  X,
  Database,
  FolderOpen
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [localBackupPath, setLocalBackupPath] = useState('');
  
  const [gdriveConnected, setGdriveConnected] = useState(false);
  const [authCode, setAuthCode] = useState('');
  const [showGdriveAuth, setShowGdriveAuth] = useState(false);
  const [restoreTargetFile, setRestoreTargetFile] = useState<BackupFileInfo | null>(null);

  const isOwner = currentSession?.role === 'owner';

  const loadData = async () => {
    if (!window.api || !isOpen) return;
    setLoading(true);
    setError(null);
    try {
      const [settings, backupList, gdriveStatus] = await Promise.all([
        window.api.settings.get(),
        isOwner ? window.api.backup.list() : Promise.resolve([]),
        isOwner && window.api.gdrive ? window.api.gdrive.status() : Promise.resolve({ isConnected: false }),
      ]);

      setLocalBackupPath((settings as any).local_backup_path || '');
      setBackups(backupList);
      setGdriveConnected(gdriveStatus.isConnected);
    } catch (err: any) {
      console.warn('Failed to fetch settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) loadData();
  }, [isOpen, isOwner]);

  if (!isOpen) return null;

  const handleSelectFolder = async () => {
    if (!window.api || !isOwner) return;
    try {
      const folderPath = await window.api.backup.selectFolder();
      if (folderPath) {
        setLocalBackupPath(folderPath);
        await window.api.settings.update({ local_backup_path: folderPath });
        toast.success('Backup folder location updated!');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to select folder');
    }
  };

  const handleCreateBackup = async () => {
    if (!window.api || !isOwner) return;
    setLoading(true);
    setError(null);
    try {
      const backup = await window.api.backup.createManual();
      toast.success('Backup saved: ' + backup.fileName);
      setSuccessMsg('Backup saved: ' + backup.fileName + ' (' + (backup.sizeBytes / 1024).toFixed(1) + ' KB)');
      setTimeout(() => setSuccessMsg(null), 3000);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create backup.');
      setError(err.message || 'Failed to create backup.');
    } finally {
      setLoading(false);
    }
  };

  const confirmRestoreBackup = async () => {
    if (!window.api || !restoreTargetFile) return;
    setRestoreTargetFile(null);
    try {
      await window.api.backup.restore(restoreTargetFile.filePath);
      toast.success('Database restored successfully! Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err: any) {
      toast.error('Restore failed: ' + err.message);
    }
  };

  const handleGdriveConnectClick = async () => {
    if (!window.api?.gdrive) return;
    setLoading(true);
    try {
      const result = await window.api.gdrive.getAuthUrl();
      if (result?.autoHandled) {
        if (result.success) {
          setGdriveConnected(true);
          toast.success('Google Drive connected successfully!');
        } else {
          toast.error(result.error || 'Authorization cancelled.');
        }
      } else {
        setShowGdriveAuth(true);
      }
    } catch(err: any) {
      toast.error(err.message || 'Failed to start authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleGdriveDisconnect = async () => {
    if (!window.api?.gdrive) return;
    try {
      await window.api.gdrive.disconnect();
      setGdriveConnected(false);
      toast.success('Google Drive disconnected');
    } catch(err) {
      toast.error('Failed to disconnect');
    }
  };

  const handleGdriveAuthorize = async () => {
    if (!window.api?.gdrive || !authCode.trim()) return;
    setLoading(true);
    try {
      const res = await window.api.gdrive.authorize(authCode);
      if (res.success) {
        setGdriveConnected(true);
        setShowGdriveAuth(false);
        setAuthCode('');
        toast.success('Google Drive connected successfully!');
      } else {
        toast.error('Authorization failed');
      }
    } catch (err: any) {
      toast.error('Failed to verify code: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <ConfirmModal
        isOpen={!!restoreTargetFile}
        onCancel={() => setRestoreTargetFile(null)}
        onConfirm={confirmRestoreBackup}
        title="Restore Database"
        message={'Are you sure you want to restore from ' + restoreTargetFile?.fileName + '? Current data will be replaced.'}
      />
      <div className="bg-white border border-jungle-teal-200 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-jungle-teal-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200 shadow-xs">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-jungle-teal-900">Backup & Security Center</h3>
              <p className="text-xs text-jungle-teal-500">Manage your local and cloud database backups.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-jungle-teal-400 hover:text-jungle-teal-700 hover:bg-jungle-teal-50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-6">
          {/* Local Backups Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-jungle-teal-600" />
                <h4 className="font-bold text-jungle-teal-800 text-sm">Local PC Backup</h4>
              </div>
              {isOwner && (
                <button onClick={handleCreateBackup} className="px-4 py-2 bg-jungle-teal-700 hover:bg-jungle-teal-800 text-white font-bold rounded-lg flex items-center gap-2 shadow-md transition-colors text-xs">
                  <Database className="w-4 h-4" />
                  Backup Now
                </button>
              )}
            </div>
            
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-600 mb-3">
                Select a specific folder on your PC where backups should be saved automatically on shift close.
              </p>
              <div className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded-lg">
                <div className="flex items-center gap-2 overflow-hidden px-2">
                  <FolderOpen className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs text-gray-700 truncate">
                    {localBackupPath || 'Default AppData Location'}
                  </span>
                </div>
                {isOwner && (
                  <button onClick={handleSelectFolder} className="shrink-0 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-md text-xs transition-colors border border-gray-300">
                    Change Folder
                  </button>
                )}
              </div>
            </div>

            {/* Google Drive Integration UI */}
            {isOwner && (
              <div className="bg-azure-mist-50 border border-azure-mist-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-azure-mist-700" />
                    <h4 className="font-bold text-jungle-teal-800 text-sm">Cloud Backup (Google Drive)</h4>
                  </div>
                  {gdriveConnected ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 border border-green-300 rounded-md text-xs font-bold">Connected</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-200 text-gray-700 border border-gray-300 rounded-md text-xs font-bold">Not Connected</span>
                  )}
                </div>
                
                {gdriveConnected ? (
                  <div>
                    <p className="text-xs text-jungle-teal-600 mb-3 leading-relaxed">
                      Your manual backups and automated local backups will automatically be uploaded to a secure folder in your Google Drive.
                    </p>
                    <button onClick={handleGdriveDisconnect} className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-lg font-bold text-xs transition-colors">
                      Disconnect Google Drive
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-jungle-teal-600 mb-4">
                      Connect your Google Drive to keep a safe, cloud-based copy of your data.
                    </p>
                    {!showGdriveAuth ? (
                      <button onClick={handleGdriveConnectClick} className="px-5 py-2.5 bg-azure-mist-600 hover:bg-azure-mist-700 text-white rounded-lg font-bold text-xs transition-colors shadow-sm">
                        Connect Google Drive
                      </button>
                    ) : (
                      <div className="space-y-3 bg-white p-4 rounded-xl border border-azure-mist-200">
                        <p className="text-xs text-jungle-teal-700 leading-relaxed">
                          1. A browser window opened. Sign in and grant permission.<br />
                          2. Google will redirect you to a "localhost" page.<br />
                          3. <b>Copy the entire URL from the address bar</b> and paste it below.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={authCode}
                            onChange={(e) => setAuthCode(e.target.value)}
                            placeholder="Paste the URL or code here..."
                            className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:border-azure-mist-500 focus:outline-hidden"
                          />
                          <button onClick={handleGdriveAuthorize} disabled={loading || !authCode} className="px-4 py-2 bg-jungle-teal-700 hover:bg-jungle-teal-800 text-white rounded-lg font-bold text-xs disabled:opacity-50 transition-colors">
                            Verify
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Backups List */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-xs">
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 text-gray-500 font-bold uppercase border-b border-gray-200 sticky top-0">
                    <tr>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Created</th>
                      {isOwner && <th className="p-3 text-center">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {backups.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-8 text-center text-gray-400">
                          No backup files created yet.
                        </td>
                      </tr>
                    ) : (
                      backups.map((b) => (
                        <tr key={b.fileName} className="hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-gray-900 font-medium">
                            <div className="flex items-center gap-2">
                              <Database className="w-3.5 h-3.5 text-gray-400" />
                              <span>{b.fileName}</span>
                              {b.isAutomatic && (
                                <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-md text-[9px] font-bold uppercase tracking-wider">
                                  Auto
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-gray-500">{(b.sizeBytes / (1024 * 1024)).toFixed(2)} MB</td>
                          <td className="p-3 text-gray-500">{new Date(b.createdAt).toLocaleString()}</td>
                          {isOwner && (
                            <td className="p-3 text-center">
                              <button onClick={() => setRestoreTargetFile(b)} className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-md border border-gray-300 font-bold text-[10px] transition-colors shadow-xs">
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
          </div>
        </div>
      </div>
    </div>
  );
};
