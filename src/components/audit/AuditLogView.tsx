import React, { useState, useEffect } from 'react';
import { AuditLogRecord, UserSession } from '../../types/ipc';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  AlertCircle,
  User,
  Shield,
} from 'lucide-react';

interface AuditLogViewProps {
  currentSession: UserSession | null;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ currentSession }) => {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [search, setSearch] = useState('');
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

const ACTION_LABELS: Record<string, string> = {
  'LOGIN_FAILED': 'Failed Login Attempt',
  'LOGIN_SUCCESS': 'User Logged In',
  'PIN_LOGIN_FAILED': 'Failed PIN Login',
  'PIN_LOGIN_SUCCESS': 'User Logged In via PIN',
  'LOGOUT': 'User Logged Out',
  'CREATE_CATEGORY': 'Created Product Category',
  'UPDATE_CATEGORY': 'Updated Product Category',
  'DELETE_CATEGORY': 'Deleted Product Category',
  'CREATE_PRODUCT': 'Added New Product',
  'UPDATE_PRODUCT': 'Updated Product Details',
  'DELETE_PRODUCT': 'Deleted Product',
  'STOCK_IN': 'Added Stock',
  'STOCK_ADJUSTMENT': 'Adjusted Stock Level',
  'BULK_IMPORT': 'Bulk Imported Products',
  'CREATE_SALE': 'Completed Sale',
  'HOLD_SALE': 'Put Sale on Hold',
  'PROCESS_RETURN': 'Processed Customer Return',
  'CREATE_CUSTOMER': 'Added New Customer',
  'UPDATE_CUSTOMER': 'Updated Customer Details',
  'DELETE_CUSTOMER': 'Deleted Customer',
  'COLLECT_DUE': 'Collected Customer Due',
  'CREATE_USER': 'Created System User',
  'UPDATE_USER': 'Updated User Account',
  'UPDATE_PIN': 'Updated User PIN',
  'CHANGE_PASSWORD': 'Changed User Password',
  'SHIFT_OPENED': 'Opened Cash Register Shift',
  'CASH_IN': 'Added Petty Cash (Cash In)',
  'CASH_OUT': 'Removed Petty Cash (Cash Out)',
  'SHIFT_CLOSED': 'Closed Cash Register Shift',
  'UPDATE_SETTINGS': 'Updated System Settings',
  'CONFIGURE_CLOUD_SYNC': 'Configured Cloud Backup Sync',
  'CREATE_SUPPLIER': 'Added New Supplier',
  'CREATE_PURCHASE': 'Recorded Purchase Invoice',
  'UPDATE_SUPPLIER': 'Updated Supplier Details',
  'DELETE_SUPPLIER': 'Deleted Supplier',
  'PAY_SUPPLIER': 'Paid Supplier Due',
  'FIRST_RUN_WIZARD_COMPLETED': 'Completed Initial Setup Wizard',
  'DEMO_DATA_SEEDED': 'Seeded Demo Data',
  'DATABASE_CLEAN_RESET': 'Performed Clean Database Reset'
};

const formatDetails = (detailJson?: string | null) => {
  if (!detailJson) return '-';
  try {
    const obj = JSON.parse(detailJson);
    if (Object.keys(obj).length === 0) return '-';
    return Object.entries(obj)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`)
      .join(', ');
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
            <h2 className="text-base font-bold text-jungle-teal-900">Activity & Audit Log</h2>
            <p className="text-xs text-jungle-teal-500">Track all actions performed by users in the system</p>
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
            placeholder="Search by action, user, or details..."
            className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-lg pl-9 pr-3 py-2 text-jungle-teal-900 text-xs font-sans focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-jungle-teal-100 text-jungle-teal-700 uppercase font-sans font-bold text-[10px] tracking-wider border-b border-jungle-teal-200">
              <tr>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">User</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-sans text-xs">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-12 text-center text-jungle-teal-500 font-sans">
                    {loading ? 'Loading audit records...' : 'No activity found.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-jungle-teal-100/50 transition-colors">
                    <td className="p-3.5 text-jungle-teal-600 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleDateString()} <span className="text-jungle-teal-400">|</span> {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="p-3.5 font-semibold text-jungle-teal-800 flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-jungle-teal-400" />
                      {log.user_name || <span className="text-jungle-teal-400 italic font-normal">System</span>}
                    </td>
                    <td className="p-3.5">
                      <span className="font-semibold text-azure-mist-800">
                        {ACTION_LABELS[log.action] || log.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3.5 text-jungle-teal-600 font-mono text-[11px] leading-relaxed max-w-md truncate" title={formatDetails(log.detail_json) as string}>
                      {formatDetails(log.detail_json)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
