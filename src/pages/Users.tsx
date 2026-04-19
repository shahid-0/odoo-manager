import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext.tsx";
import api from "../lib/api.ts";
import { toast } from "sonner";
import {
  Users as UsersIcon,
  Plus,
  Trash2,
  KeyRound,
  Loader2,
  Shield,
  Eye,
  X,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface UserRow {
  id: string;
  username: string;
  role: "admin" | "viewer";
  createdAt: string;
  lastLoginAt: string | null;
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Add user modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "viewer">("viewer");
  const [addLoading, setAddLoading] = useState(false);

  // Reset password modal
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await api.get("/users");
      setUsers(res.data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      await api.post("/users", {
        username: newUsername,
        password: newPassword,
        role: newRole,
      });
      toast.success(`User "${newUsername}" created`);
      setShowAddModal(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("viewer");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create user");
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success(`User "${username}" deleted`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete user");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUserId) return;
    setResetLoading(true);
    try {
      await api.post(`/users/${resetUserId}/reset-password`, {
        newPassword: resetPassword,
      });
      toast.success("Password reset successfully");
      setResetUserId(null);
      setResetPassword("");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reset password");
    } finally {
      setResetLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          </div>
          <p className="text-zinc-500 ml-[52px]">
            Manage users and their access levels.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="
            flex items-center gap-2 h-10 px-4 bg-zinc-900 text-white text-sm font-semibold rounded-lg
            hover:bg-zinc-800 transition-colors shadow-sm
          "
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-zinc-200 rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <th className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider px-6 py-3.5">
                Username
              </th>
              <th className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider px-6 py-3.5">
                Role
              </th>
              <th className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider px-6 py-3.5">
                Last Login
              </th>
              <th className="text-right text-xs font-semibold text-zinc-500 uppercase tracking-wider px-6 py-3.5">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isOwnRow = u.id === currentUser?.id;
              return (
                <motion.tr
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-bold text-zinc-500 uppercase">
                        {u.username.slice(0, 2)}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-zinc-900">{u.username}</span>
                        {isOwnRow && (
                          <span className="ml-2 text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                            YOU
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.role === "admin" ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-100 text-purple-700">
                        <Shield className="w-3 h-3" />
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-zinc-100 text-zinc-600">
                        <Eye className="w-3 h-3" />
                        Viewer
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-zinc-500">{formatDate(u.lastLoginAt)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => {
                          setResetUserId(u.id);
                          setResetPassword("");
                        }}
                        className="
                          p-2 rounded-lg text-zinc-400 hover:text-amber-600 hover:bg-amber-50
                          transition-colors
                        "
                        title="Reset password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        disabled={isOwnRow}
                        className="
                          p-2 rounded-lg transition-colors
                          disabled:opacity-30 disabled:cursor-not-allowed
                          text-zinc-400 hover:text-red-600 hover:bg-red-50
                          disabled:hover:text-zinc-400 disabled:hover:bg-transparent
                        "
                        title={isOwnRow ? "Cannot delete your own account" : "Delete user"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
        {users.length === 0 && (
          <div className="text-center py-12 text-zinc-400 text-sm">No users found.</div>
        )}
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowAddModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h2 className="text-lg font-semibold">Add New User</h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">Username</label>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="
                      w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400
                    "
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">Password</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="
                      w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400
                    "
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-zinc-400">Minimum 6 characters</p>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">Role</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setNewRole("viewer")}
                      className={`
                        flex-1 h-10 rounded-lg text-sm font-medium border transition-all
                        ${
                          newRole === "viewer"
                            ? "bg-zinc-900 text-white border-zinc-900"
                            : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                        }
                      `}
                    >
                      Viewer
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRole("admin")}
                      className={`
                        flex-1 h-10 rounded-lg text-sm font-medium border transition-all
                        ${
                          newRole === "admin"
                            ? "bg-purple-600 text-white border-purple-600"
                            : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
                        }
                      `}
                    >
                      Admin
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="
                    w-full h-10 bg-zinc-900 text-white text-sm font-semibold rounded-lg
                    hover:bg-zinc-800 disabled:opacity-50 transition-colors mt-2
                    flex items-center justify-center gap-2
                  "
                >
                  {addLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetUserId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setResetUserId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
                <h2 className="text-lg font-semibold">Reset Password</h2>
                <button
                  onClick={() => setResetUserId(null)}
                  className="p-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleResetPassword} className="p-6 space-y-4">
                <div className="flex items-start gap-3 bg-amber-50 text-amber-700 text-sm px-4 py-3 rounded-lg border border-amber-100">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Resetting password for{" "}
                    <strong>{users.find((u) => u.id === resetUserId)?.username}</strong>. This
                    action cannot be undone.
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-zinc-700">New Password</label>
                  <input
                    type="password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="
                      w-full h-10 px-3 bg-zinc-50 border border-zinc-200 rounded-lg text-sm
                      focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400
                    "
                    required
                    minLength={6}
                    autoFocus
                  />
                  <p className="text-xs text-zinc-400">Minimum 6 characters</p>
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="
                    w-full h-10 bg-amber-600 text-white text-sm font-semibold rounded-lg
                    hover:bg-amber-700 disabled:opacity-50 transition-colors
                    flex items-center justify-center gap-2
                  "
                >
                  {resetLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset Password"
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
