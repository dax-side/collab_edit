import { useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';

interface AuthPageProps {
  onBack?: () => void;
  onForgotPassword?: () => void;
}

export function AuthPage({ onBack, onForgotPassword }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const { login, register } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError('');

    if (!email || !password) {
      setLocalError('Email and password are required');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f1e8]">
      <div className="w-full max-w-md">
        {onBack && (
          <button
            onClick={onBack}
            className="mb-6 text-sm hover:underline flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to home
          </button>
        )}

        <div className="p-8 bg-white border-2 border-gray-900">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gray-900 flex items-center justify-center border-2 border-gray-900">
              <span className="text-sm font-bold text-white">CE</span>
            </div>
            <h1 className="text-2xl font-bold">
              {isLogin ? 'Sign In' : 'Create Account'}
            </h1>
          </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="email" className="block text-sm font-bold uppercase tracking-wide mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-900 bg-white text-gray-900 focus:outline-none focus:ring-0 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white]"
              disabled={submitting}
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-bold uppercase tracking-wide mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-900 bg-white text-gray-900 focus:outline-none focus:ring-0 autofill:bg-white autofill:shadow-[inset_0_0_0px_1000px_white]"
              disabled={submitting}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
            {isLogin && onForgotPassword && (
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-gray-600 hover:underline mt-2"
              >
                Forgot password?
              </button>
            )}
          </div>

          {localError && (
            <div className="text-sm bg-red-50 px-3 py-2.5 border-2 border-red-500">
              {localError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-[#f4d03f] text-gray-900 font-bold uppercase tracking-wide hover:bg-[#e5c536] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors border-0"
          >
            {submitting ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setLocalError('');
            }}
            className="text-sm hover:underline outline-none focus:outline-none"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
