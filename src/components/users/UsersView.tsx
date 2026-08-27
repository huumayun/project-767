import React, { useState, useEffect } from 'react';
import { UserRecord, UserSession } from '../../types/ipc';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Edit2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface UsersViewProps {
  currentSession: UserSession | null;
}

export const UsersView: React.FC<UsersViewProps> = ({ currentSession }) => {
  const toast = useToast();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create/Edit User Modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<'owner' | 'staff'>('staff');
  const [formPassword, setFormPassword] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Change Password Modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordTargetUser, setPasswordTargetUser] = useState<UserRecord | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const isOwner = currentSession?.role === 'owner';

  const fetchUsers = async () => {
    if (!window.api || !isOwner) return;
    setLoading(true);
    setError(null);
    try {
      const list = await window.api.users.list();
      setUsers(list);
    } catch (err: any) {
      setError(err.message || 'Failed to load users list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isOwner]);

  const handleOpenCreate = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormName('');
    setFormRole('staff');
    setFormPassword('');
    setFormIsActive(true);
    setShowFormModal(true);
  };

  const handleOpenEdit = (user: UserRecord) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormName(user.name);
    setFormRole(user.role);
    setFormPassword('');
    setFormIsActive(Boolean(user.is_active));
    setShowFormModal(true);
  };

  const handleOpenPassword = (user: UserRecord) => {
    setPasswordTargetUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api) return;

    try {
      if (editingUser) {
        await window.api.users.update({
          id: editingUser.id,
          name: formName,
          role: formRole,
          is_active: formIsActive ? 1 : 0,
        });
        toast.success(`User "${formName}" updated successfully.`);
      } else {
        await window.api.users.create({
          username: formUsername,
          name: formName,
          role: formRole,
          password: formPassword,
        });
        toast.success(`New user "${formUsername}" created.`);
      }
      setShowFormModal(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save user.');
      setError(err.message || 'Failed to save user.');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.api || !passwordTargetUser) return;
    try {
      await window.api.users.changePassword({
        userId: passwordTargetUser.id,
        newPassword,
      });
      toast.success(`Password for ${passwordTargetUser.username} updated successfully!`);
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password.');
    }
  };

  if (!isOwner) {
    return (
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl p-12 text-center text-jungle-teal-500 space-y-2 shadow-xs">
        <Shield className="w-12 h-12 mx-auto text-amber-500" />
        <h3 className="text-base font-bold text-jungle-teal-900">Owner Authorization Required</h3>
        <p className="text-xs text-jungle-teal-500 max-w-sm mx-auto">
          User creation, role assignments, and password resets are strictly restricted to Owner accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-6 text-jungle-teal-900 pb-2">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-jungle-teal-50 border border-jungle-teal-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-azure-mist-50 text-azure-mist-700 rounded-xl border border-azure-mist-200">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-jungle-teal-900">User & Staff Management</h2>
            <p className="text-xs text-jungle-teal-500">Configure cashier permissions, staff logins, and password security</p>
          </div>
        </div>

        <button
          onClick={handleOpenCreate}
          className="px-4 py-2 bg-azure-mist-700 hover:bg-azure-mist-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md"
        >
          <UserPlus className="w-4 h-4" />
          Add New User
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-jungle-teal-100 text-jungle-teal-600 uppercase font-mono text-[10px] tracking-wider border-b border-jungle-teal-200">
              <tr>
                <th className="p-3.5">Full Name</th>
                <th className="p-3.5">Username</th>
                <th className="p-3.5 text-center">Role</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5">Created Date</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-jungle-teal-100 font-mono text-[11.5px]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-jungle-teal-50 transition-colors">
                  <td className="p-3.5 font-sans font-bold text-jungle-teal-900">{u.name}</td>
                  <td className="p-3.5 font-mono text-azure-mist-800 font-semibold">{u.username}</td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.role === 'owner'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-jungle-teal-100 text-jungle-teal-700 border border-jungle-teal-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="p-3.5 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.is_active
                          ? 'text-muted-teal-900 bg-muted-teal-100'
                          : 'text-rose-800 bg-rose-100'
                      }`}
                    >
                      {u.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {u.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="p-3.5 text-jungle-teal-600">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="p-1.5 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-lg border border-jungle-teal-300 transition-colors"
                        title="Edit User"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setPasswordTargetUser(u);
                          setShowPasswordModal(true);
                        }}
                        className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-300 transition-colors"
                        title="Reset Password"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit User Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-jungle-teal-900 my-8 space-y-4">
            <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
              <h3 className="text-base font-bold text-jungle-teal-900">
                {editingUser ? 'Edit User Account' : 'Create New User'}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-jungle-teal-700 font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Md. Hasan"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                />
              </div>

              <div>
                <label className="block text-jungle-teal-700 font-semibold mb-1">Username (Login ID)</label>
                <input
                  type="text"
                  required
                  disabled={Boolean(editingUser)}
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="e.g. hasan_staff"
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 disabled:opacity-50"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-jungle-teal-700 font-semibold mb-1">Initial Password</label>
                  <input
                    type="password"
                    required
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
                  />
                </div>
              )}

              <div>
                <label className="block text-jungle-teal-700 font-semibold mb-1">System Role</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50 font-semibold"
                >
                  <option value="staff">Staff / Cashier (POS & Sales only)</option>
                  <option value="owner">Owner (Full access: reports, profit, inventory edits)</option>
                </select>
              </div>

              {editingUser && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded-sm bg-jungle-teal-100 border-jungle-teal-300 text-azure-mist-700 focus:ring-0"
                  />
                  <label htmlFor="isActive" className="text-jungle-teal-700 font-semibold cursor-pointer">
                    Account is Active (Allow login)
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-azure-mist-700 hover:bg-azure-mist-600 text-white font-bold rounded-xl shadow-md transition-colors"
                >
                  Save User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && passwordTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-jungle-teal-900/50 backdrop-blur-xs p-4">
          <div className="bg-jungle-teal-50 border border-jungle-teal-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-jungle-teal-900 space-y-4">
            <div className="flex items-center justify-between border-b border-jungle-teal-200 pb-3">
              <h3 className="text-base font-bold text-jungle-teal-900">Reset Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-jungle-teal-400 hover:text-jungle-teal-700 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-3 text-xs">
              <p className="text-jungle-teal-600">
                Enter new password for user <strong className="text-azure-mist-800">{passwordTargetUser.username}</strong>:
              </p>

              <input
                type="password"
                required
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password (min 4 chars)"
                className="w-full bg-jungle-teal-50 border border-jungle-teal-300 rounded-xl px-3 py-2 text-jungle-teal-900 font-mono focus:outline-hidden focus:border-azure-mist-600 focus:bg-jungle-teal-50"
              />

              <div className="flex justify-end gap-2 pt-2 border-t border-jungle-teal-200">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-4 py-2 bg-jungle-teal-100 hover:bg-jungle-teal-200 text-jungle-teal-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl shadow-md transition-colors"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
