import { useState, useEffect, type FormEvent } from 'react';

interface Collaborator {
  user: {
    id: string;
    email: string;
  };
  role: string;
  grantedAt: string;
}

interface ShareModalProps {
  documentId: string;
  onClose: () => void;
}

export function ShareModal({ documentId, onClose }: ShareModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [owner, setOwner] = useState<{ id: string; email: string } | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadCollaborators();
  }, [documentId]);

  async function loadCollaborators() {
    try {
      const res = await fetch(`/documents/${documentId}/access`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setOwner(data.data.owner);
        setCollaborators(data.data.collaborators);
      }
    } catch (err) {
      console.error('Failed to load collaborators:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('Email is required');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/documents/${documentId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to invite user');
      }

      setSuccess(`Invited ${email} as ${role}`);
      setEmail('');
      loadCollaborators();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(userId: string) {
    if (!confirm('Revoke access for this user?')) return;

    try {
      const res = await fetch(`/documents/${documentId}/access/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (res.ok) {
        loadCollaborators();
        setSuccess('Access revoked');
      }
    } catch (err) {
      setError('Failed to revoke access');
    }
  }

  async function handleGenerateLink() {
    setError('');
    setShareLink('');

    try {
      const res = await fetch(`/documents/${documentId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ expiresInDays: 7 }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to generate link');
      }

      const fullUrl = `${window.location.origin}${data.data.shareUrl}`;
      setShareLink(fullUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link');
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(shareLink);
    setSuccess('Link copied to clipboard');
  }

  return (
    <div className="fixed inset-0 bg-black/[0.45] flex items-center justify-center z-50">
      <div className="bg-white border-2 border-gray-900 w-full max-w-lg max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-gray-900">
          <h2 className="text-lg font-bold text-gray-900">Share Document</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 text-2xl leading-none font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Status messages */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 border border-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-600 bg-green-50 px-3 py-2 border border-green-200">
              {success}
            </div>
          )}

          {/* Invite form */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Invite by email</h3>
            <form onSubmit={handleInvite} className="space-y-3">
              <div>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
                  disabled={submitting}
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                  className="flex-1 px-3 py-2 border border-gray-300 text-sm text-gray-900 focus:outline-none focus:border-gray-900"
                  disabled={submitting}
                >
                  <option value="editor">Can edit</option>
                  <option value="viewer">Can view</option>
                </select>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[#f4d03f] text-gray-900 text-sm font-bold hover:bg-[#e5c536] disabled:bg-gray-300 transition-colors"
                >
                  {submitting ? 'Inviting...' : 'Invite'}
                </button>
              </div>
            </form>
          </div>

          {/* Collaborators list */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">People with access</h3>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : (
              <div className="space-y-2">
                {/* Owner */}
                {owner && (
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div>
                      <p className="text-sm text-gray-900">{owner.email}</p>
                      <p className="text-xs text-gray-500">Owner</p>
                    </div>
                  </div>
                )}

                {/* Collaborators */}
                {collaborators.map((collab) => (
                  <div
                    key={collab.user.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100"
                  >
                    <div>
                      <p className="text-sm text-gray-900">{collab.user.email}</p>
                      <p className="text-xs text-gray-500 capitalize">{collab.role}</p>
                    </div>
                    <button
                      onClick={() => handleRevoke(collab.user.id)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {collaborators.length === 0 && (
                  <p className="text-sm text-gray-500">No collaborators yet</p>
                )}
              </div>
            )}
          </div>

          {/* Share link */}
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">Share link</h3>
            {!shareLink ? (
              <button
                onClick={handleGenerateLink}
                className="text-sm text-gray-600 hover:text-gray-900 hover:underline"
              >
                Generate read-only link
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 text-sm text-gray-900 bg-gray-50"
                />
                <button
                  onClick={copyLink}
                  className="w-full py-2 px-4 bg-gray-900 text-white text-sm hover:bg-gray-800"
                >
                  Copy link
                </button>
                <p className="text-xs text-gray-500">Link expires in 7 days</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
