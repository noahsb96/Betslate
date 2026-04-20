import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { authAPI } from '../../services/authAPI';

const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found in the link.');
      return;
    }

    authAPI.verifyEmail(token)
      .then(data => {
        setMessage(data.message);
        setStatus('success');
      })
      .catch(err => {
        setMessage(err.message);
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-[#36393f] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-indigo-600 rounded-md flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/50 text-sm">
            BS
          </div>
          <h1 className="text-2xl font-bold text-white">BetSlate AI</h1>
        </div>

        <div className="bg-[#2f3136] rounded-lg p-8 border border-gray-700 shadow-xl text-center">
          {status === 'loading' && (
            <>
              <Loader className="animate-spin text-indigo-400 mx-auto mb-4" size={32} />
              <p className="text-gray-300">Verifying your email...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="text-green-400" size={28} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Email verified!</h2>
              <p className="text-gray-400 text-sm mb-6">{message}</p>
              <Link
                to="/login"
                className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded transition-colors text-center"
              >
                Sign in
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="text-red-400" size={28} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Verification failed</h2>
              <p className="text-red-300 text-sm mb-6">{message}</p>
              <div className="space-y-2">
                <Link
                  to="/signup"
                  className="block w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded transition-colors text-center"
                >
                  Register again
                </Link>
                <Link to="/login" className="block text-indigo-400 hover:text-indigo-300 font-medium text-sm transition-colors mt-2">
                  Back to sign in
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerifyEmailPage;
