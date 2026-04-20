import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, CheckCircle, XCircle, ArrowLeft, Mail, Lock } from 'lucide-react';
import { authAPI, clearToken } from '../../services/authAPI';
import { User } from '../../types';

interface AccountPageProps {
  user: User;
  onLogout: () => void;
}

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

const AccountPage: React.FC<AccountPageProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();

  // Change password state
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  // Change email state
  const [emailPw, setEmailPw] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [showEmailPw, setShowEmailPw] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  const allRulesMet = PASSWORD_RULES.every(r => r.test(newPw));
  const passwordsMatch = newPw === confirmPw;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (!allRulesMet) { setPwError('New password does not meet all requirements.'); return; }
    if (!passwordsMatch) { setPwError('Passwords do not match.'); return; }

    setPwLoading(true);
    try {
      const data = await authAPI.changePassword(currentPw, newPw);
      setPwSuccess(data.message);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      setPwError(err.message);
    } finally {
      setPwLoading(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    setEmailLoading(true);
    try {
      const data = await authAPI.changeEmail(emailPw, newEmail);
      setEmailSuccess(data.message);
      setEmailPw('');
      setNewEmail('');
    } catch (err: any) {
      setEmailError(err.message);
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#36393f] pb-20">
      <header className="bg-[#202225] p-4 shadow-md sticky top-0 z-50 border-b border-gray-800">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
              title="Back to app"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="w-8 h-8 bg-indigo-600 rounded-md flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/50 text-sm">
              BS
            </div>
            <h1 className="text-lg font-bold text-white">Account Settings</h1>
          </div>
          <span className="text-xs text-gray-500 hidden sm:block">{user.email}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">

        {/* Change Password */}
        <div className="bg-[#2f3136] rounded-lg p-6 border border-gray-700">
          <div className="flex items-center space-x-2 mb-5 pb-3 border-b border-gray-700">
            <Lock size={18} className="text-indigo-400" />
            <h2 className="text-base font-bold text-white">Change Password</h2>
          </div>

          {pwSuccess && (
            <div className="bg-green-500/10 border border-green-500 text-green-300 text-sm rounded p-3 mb-4 flex items-center space-x-2">
              <CheckCircle size={15} className="flex-shrink-0" />
              <span>{pwSuccess}</span>
            </div>
          )}
          {pwError && (
            <div className="bg-red-500/10 border border-red-500 text-red-300 text-sm rounded p-3 mb-4">
              {pwError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Current password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#202225] border border-gray-700 rounded p-2.5 pr-10 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowCurrentPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" tabIndex={-1}>
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">New password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full bg-[#202225] border border-gray-700 rounded p-2.5 pr-10 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" tabIndex={-1}>
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {newPw.length > 0 && (
              <ul className="space-y-1 bg-[#202225] rounded p-3 border border-gray-700">
                {PASSWORD_RULES.map(rule => {
                  const met = rule.test(newPw);
                  return (
                    <li key={rule.label} className="flex items-center space-x-2 text-xs">
                      {met ? <CheckCircle size={13} className="text-green-400 flex-shrink-0" /> : <XCircle size={13} className="text-gray-600 flex-shrink-0" />}
                      <span className={met ? 'text-green-400' : 'text-gray-500'}>{rule.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-1">Confirm new password</label>
              <div className="relative">
                <input
                  type={showConfirmPw ? 'text' : 'password'}
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`w-full bg-[#202225] border rounded p-2.5 pr-10 text-white focus:outline-none transition-colors ${
                    confirmPw.length > 0 && !passwordsMatch ? 'border-red-500' : 'border-gray-700 focus:border-indigo-500'
                  }`}
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowConfirmPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" tabIndex={-1}>
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPw.length > 0 && !passwordsMatch && (
                <p className="text-xs text-red-400 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pwLoading || !allRulesMet || !passwordsMatch || !currentPw}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded transition-colors"
            >
              {pwLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Change Email */}
        <div className="bg-[#2f3136] rounded-lg p-6 border border-gray-700">
          <div className="flex items-center space-x-2 mb-5 pb-3 border-b border-gray-700">
            <Mail size={18} className="text-indigo-400" />
            <h2 className="text-base font-bold text-white">Change Email</h2>
          </div>

          <p className="text-sm text-gray-400 mb-4">
            Current email: <span className="text-white font-medium">{user.email}</span>
          </p>

          {emailSuccess && (
            <div className="bg-green-500/10 border border-green-500 text-green-300 text-sm rounded p-3 mb-4 flex items-center space-x-2">
              <CheckCircle size={15} className="flex-shrink-0" />
              <span>{emailSuccess}</span>
            </div>
          )}
          {emailError && (
            <div className="bg-red-500/10 border border-red-500 text-red-300 text-sm rounded p-3 mb-4">
              {emailError}
            </div>
          )}

          <form onSubmit={handleChangeEmail} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">New email address</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full bg-[#202225] border border-gray-700 rounded p-2.5 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="new@example.com"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Current password to confirm</label>
              <div className="relative">
                <input
                  type={showEmailPw ? 'text' : 'password'}
                  value={emailPw}
                  onChange={e => setEmailPw(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#202225] border border-gray-700 rounded p-2.5 pr-10 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowEmailPw(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300" tabIndex={-1}>
                  {showEmailPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={emailLoading || !newEmail || !emailPw}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded transition-colors"
            >
              {emailLoading ? 'Sending confirmation...' : 'Send Confirmation Email'}
            </button>
          </form>
        </div>

        {/* Danger zone */}
        <div className="bg-[#2f3136] rounded-lg p-6 border border-red-900/40">
          <h2 className="text-base font-bold text-white mb-3">Sign Out</h2>
          <p className="text-sm text-gray-400 mb-4">Sign out of your account on this device.</p>
          <button
            onClick={onLogout}
            className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 text-red-400 font-medium rounded transition-colors text-sm"
          >
            Sign Out
          </button>
        </div>

      </main>
    </div>
  );
};

export default AccountPage;
