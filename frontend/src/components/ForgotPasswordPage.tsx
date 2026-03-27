import { useState, type FormEvent } from 'react';

interface ForgotPasswordPageProps {
  onBack: () => void;
}

export function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Email is required');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
        credentials: 'include',
      });

      const text = await res.text();
      const body = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(body.error || 'Failed to send reset email');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f5f1e8]">
        <div className="w-full max-w-md">
          <button
            onClick={onBack}
            className="mb-6 text-sm hover:underline flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to sign in
          </button>

          <div className="p-8 bg-white border-2 border-gray-900">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-900 flex items-center justify-center border-2 border-gray-900">
                <span className="text-sm font-bold text-white">CE</span>
              </div>
              <h1 className="text-2xl font-bold">Check your email</h1>
            </div>

            <p className="text-gray-600 mb-6">
              If an account exists with <strong>{email}</strong>, you'll receive a password reset link shortly.
            </p>

            <p className="text-sm text-gray-500">
              Didn't receive an email? Check your spam folder or try again.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#f5f1e8]">
      <div className="w-full max-w-md">
        <button
          onClick={onBack}
          className="mb-6 text-sm hover:underline flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to sign in
        </button>

        <div className="p-8 bg-white border-2 border-gray-900">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gray-900 flex items-center justify-center border-2 border-gray-900">
              <span className="text-sm font-bold text-white">CE</span>
            </div>
            <h1 className="text-2xl font-bold">Reset Password</h1>
          </div>

          <p className="text-gray-600 mb-6">
            Enter your email address and we'll send you a link to reset your password.
          </p>

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
                className="w-full px-3 py-2.5 border-2 border-gray-900 bg-white text-gray-900 focus:outline-none focus:ring-0"
                disabled={submitting}
                autoComplete="email"
              />
            </div>

            {error && (
              <div className="text-sm bg-red-50 px-3 py-2.5 border-2 border-red-500">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-[#f4d03f] text-gray-900 font-bold uppercase tracking-wide hover:bg-[#e5c536] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors border-0"
            >
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
