import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import { authAPI } from '../../services/authAPI';

interface PasswordRule {
  label: string;
  test: (p: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: 'At least 8 characters', test: p => p.length >= 8 },
  { label: 'One uppercase letter (A–Z)', test: p => /[A-Z]/.test(p) },
  { label: 'One lowercase letter (a–z)', test: p => /[a-z]/.test(p) },
  { label: 'One number (0–9)', test: p => /\d/.test(p) },
  { label: 'One special character (!@#$%…)', test: p => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) }
];

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const allRulesMet = PASSWORD_RULES.every(r => r.test(password));
  const passwordsMatch = password === confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid reset link. Please request a new one.');
      return;
    }
    if (!allRulesMet) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#36393f] flex items-center justify-center p-4">
        <div className="bg-[#2f3136] rounded-lg p-8 border border-gray-700 shadow-xl text-center max-w-sm w-full">
          <p className="text-red-400 mb-4">Invalid or missing reset token.</p>
          <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors">
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

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
          <h2 className="text-xl font-bold text-white mb-6 text-center">Set new password</h2>

          {success ? (
            <div className="text-center">
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-400" size={28} />
              </div>
              <p className="text-gray-300 text-sm mb-6">Your password has been reset successfully.</p>
              <Link
                to="/login"
                className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded transition-colors text-center"
              >
                Sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-300 text-sm rounded p-3 mb-4">
                  {error}
                  {error.includes('expired') && (
                    <span> <Link to="/forgot-password" className="underline text-red-200">Request a new one.</Link></span>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">New password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
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

                {password.length > 0 && (
                  <ul className="space-y-1 bg-[#202225] rounded p-3 border border-gray-700">
                    {PASSWORD_RULES.map(rule => {
                      const met = rule.test(password);
                      return (
                        <li key={rule.label} className="flex items-center space-x-2 text-xs">
                          {met
                            ? <CheckCircle size={13} className="text-green-400 flex-shrink-0" />
                            : <XCircle size={13} className="text-gray-600 flex-shrink-0" />}
                          <span className={met ? 'text-green-400' : 'text-gray-500'}>{rule.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div>
                  <label className="block text-sm text-gray-400 mb-1">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={`w-full bg-[#202225] border rounded p-2.5 pr-10 text-white focus:outline-none transition-colors ${
                        confirm.length > 0 && !passwordsMatch
                          ? 'border-red-500 focus:border-red-500'
                          : 'border-gray-700 focus:border-indigo-500'
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {confirm.length > 0 && !passwordsMatch && (
                    <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !allRulesMet || !passwordsMatch}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded transition-colors"
                >
                  {loading ? 'Resetting...' : 'Reset password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
