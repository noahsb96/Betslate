import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../services/authAPI';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authAPI.forgotPassword(email);
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
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
          <h2 className="text-xl font-bold text-white mb-2 text-center">Reset your password</h2>
          <p className="text-gray-400 text-sm text-center mb-6">
            Enter your email and we'll send you a reset link.
          </p>

          {submitted ? (
            <div className="text-center">
              <div className="bg-green-500/10 border border-green-500 text-green-300 text-sm rounded p-3 mb-6">
                If an account with that email exists, a reset link has been sent. Check your inbox.
              </div>
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors">
                Back to sign in
              </Link>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-300 text-sm rounded p-3 mb-4">
                  {error}
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

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded transition-colors"
                >
                  {loading ? 'Sending...' : 'Send reset link'}
                </button>
              </form>

              <p className="text-sm text-gray-400 text-center mt-6">
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
