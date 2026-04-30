import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { authAPI, setToken } from '../../services/authAPI';
import { User } from '../../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendMessage(null);
    try {
      const res = await fetch(`${import.meta.env.PROD ? '/api' : 'http://localhost:3001/api'}/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setResendMessage(data.message || 'Verification email sent.');
    } catch {
      setResendMessage('Failed to resend. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authAPI.login(email, password, rememberMe);
      setToken(data.token, rememberMe);
      onLogin(data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
      if (err.message?.includes('verify your email')) {
        setShowResend(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#36393f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-md flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/50 text-sm">
            BS
          </div>
          <h1 className="text-2xl font-bold text-white">BetSlate AI</h1>
        </div>

        <div className="bg-[#2f3136] rounded-lg p-8 border border-gray-700 shadow-xl">
          <h2 className="text-xl font-bold text-white mb-6 text-center">Welcome back</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500 text-red-300 text-sm rounded p-3 mb-4">
              {error}
              {showResend && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    className="text-indigo-400 hover:text-indigo-300 underline text-sm disabled:opacity-60"
                  >
                    {resendLoading ? 'Sending...' : 'Resend verification email'}
                  </button>
                </div>
              )}
            </div>
          )}

          {resendMessage && (
            <div className="bg-green-500/10 border border-green-500 text-green-300 text-sm rounded p-3 mb-4">
              {resendMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#202225] border border-gray-700 rounded p-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#202225] border border-gray-700 rounded p-2.5 pr-10 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-[#202225] border-gray-600 accent-indigo-500"
                />
                <span className="text-sm text-gray-400">Remember me</span>
              </label>
              <Link to="/forgot-password" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-sm text-gray-400 text-center mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
