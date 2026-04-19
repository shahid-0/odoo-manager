import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext.tsx";
import { Server, Loader2, AlertCircle, Lock } from "lucide-react";
import { motion } from "motion/react";

export default function Login() {
  const { login, user, loading: authLoading } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect to / immediately if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      window.location.href = "/";
    }
  }, [user, authLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(username, password);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  // Show nothing while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  // If already logged in, don't render login page
  if (user) return null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-zinc-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-zinc-200/40 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl shadow-zinc-200/50 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center">
            <div className="w-14 h-14 bg-zinc-900 rounded-xl flex items-center justify-center mx-auto mb-5 shadow-lg">
              <Server className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Odoo Manager</h1>
            <p className="text-sm text-zinc-500 mt-1.5">Sign in to manage your deployments</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2.5 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-100"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <div className="space-y-2">
              <label htmlFor="login-username" className="block text-sm font-medium text-zinc-700">
                Username
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="
                  w-full h-11 px-4 bg-zinc-50 border border-zinc-200 rounded-lg
                  text-sm text-zinc-900 placeholder:text-zinc-400
                  focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400
                  transition-colors
                "
                placeholder="Enter your username"
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="block text-sm font-medium text-zinc-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="
                    w-full h-11 px-4 pr-10 bg-zinc-50 border border-zinc-200 rounded-lg
                    text-sm text-zinc-900 placeholder:text-zinc-400
                    focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-400
                    transition-colors
                  "
                  placeholder="Enter your password"
                  required
                />
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="
                w-full h-11 bg-zinc-900 text-white text-sm font-semibold rounded-lg
                hover:bg-zinc-800 active:bg-zinc-950
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors flex items-center justify-center gap-2
                shadow-sm
              "
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-400">
          Docker-based Odoo deployment manager
        </p>
      </motion.div>
    </div>
  );
}
