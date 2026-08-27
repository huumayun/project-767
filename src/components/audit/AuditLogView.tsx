import React, { useState, useEffect } from 'react';
import { AuditLogRecord, UserSession } from '../../types/ipc';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  AlertCircle,
  FileCode,
  Calendar,
  User,
  Shield,
  X,
} from 'lucide-react';

interface AuditLogViewProps {
  currentSession: UserSession | null;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentSession }) => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = currentSession?.role === 'owner';

  const fetchLogs = async () => {
    if (!window.api || !isOwner) return;
    setLoading(true);
    setError(null);
    try {
      const list = await window.api.audit.list(200);
      setLogs(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  if (!isOwner) {
    return (
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-12 text-center text-jungle-teal-500 space-y-2 shadow-xs">
        <Shield className="w-12 h-12 mx-auto text-amber-500" />
        <h3 className="text-base font-bold text-jungle-teal-900">Owner Authorization Required</h3>
        <p className="text-xs text-jungle-teal-500 max-w-sm mx-auto">
          Security audit trails and forensic action logs are strictly restricted to the Owner.
        </p>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    const entity = log.entity || '';
    const username = log.user_name || '';
    return (
      log.action.toLowerCase().includes(q) ||
      entity.toLowerCase().includes(q) ||
      (log.entity_id && log.entity_id.toLowerCase().includes(q)) ||
      username.toLowerCase().includes(q)
    );
  });

  const parseDetailJson = (detailJson?: string | null) => {
    if (!detailJson) return null;
    try {
      return JSON.parse(detailJson);
    } catch {
      return detailJson;
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 text-jungle-teal-900 pb-2">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-jungle-teal-900">Security & Forensic Audit Trail</h2>
            <p className="text-xs text-jungle-teal-500">Immutable forensic audit log of all POS transactions and database events</p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl border border-jungle-teal-300 transition-colors"
          title="Reload Logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Toolbar */}
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 p-3 rounded-xl flex items-center gap-3 text-xs shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-jungle-teal-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter audit logs by action (e.g. SALE_CREATED, DUE_COLLECTED), user, or entity..."
            className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-lg pl-9 pr-3 py-2 text-jungle-teal-900 text-xs font-sans focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-jungle-teal-100 text-jungle-teal-600 uppercase font-mono text-[10px] tracking-wider border-b border-jungle-teal-200">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Action Event</th>
                <th className="p-3.5">Entity</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Entity ID</th>
                <th className="p-3.5 text-center">Payload Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono text-[11.5px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-jungle-teal-500 font-sans">
                    {loading ? 'Loading audit records...' : 'No audit entries found.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-jungle-teal-50 transition-colors">
                    <td className="p-3.5 text-jungle-teal-600">
                      {new Date(log.created_at).toLocaleDateString()} {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-azure-mist-800 bg-azure-mist-50 px-2 py-0.5 rounded-sm border border-azure-mist-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5 font-sans font-semibold text-jungle-teal-800 uppercase text-[10.5px]">
                      {log.entity}
                    </td>
                    <td className="p-3.5 font-sans text-jungle-teal-700">
                      {log.user_name || <span className="text-jungle-teal-400 italic">system</span>}
                    </td>
                    <td className="p-3.5 text-jungle-teal-500 font-mono text-[10.5px]">
                      {log.entity_id ? log.entity_id.slice(0, 12) + '...' : '-'}
                    </td>
                    <td className="p-3.5 text-center">
                      {log.detail_json ? (
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="px-2.5 py-1 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-lg border border-jungle-teal-300 text-[11px] font-sans font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                          <FileCode className="w-3.5 h-3.5 text-azure-mist-700" />
                          <span>View JSON</span>
                        </button>
                      ) : (
                        <span className="text-jungle-teal-400 text-[10px]">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-xl w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3 font-sans">
              <div>
                <h3 className="text-base font-bold text-jungle-teal-900">Audit Entry Details</h3>
                <p className="text-xs text-azure-mist-800 font-mono">{selectedLog.action} • {selectedLog.entity}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-jungle-teal-900 text-muted-teal-400 p-4 rounded-xl text-xs overflow-x-auto max-h-80 overflow-y-auto">
              <pre>{JSON.stringify(parseDetailJson(selectedLog.detail_json), null, 2)}</pre>
            </div>

            <div className="flex justify-end pt-2 border-t border-jungle-teal-200 font-sans">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
