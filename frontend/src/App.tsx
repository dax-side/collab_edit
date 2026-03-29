import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { DocList } from './components/DocList';
import { PresenceList } from './components/PresenceList';
import { AuthPage } from './components/AuthPage';
import { LandingPage } from './components/LandingPage';
import { ShareModal } from './components/ShareModal';
import { ForgotPasswordPage } from './components/ForgotPasswordPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuth } from './hooks/useAuth';
import { CRDTDocument } from './crdt/document';
import { type Op } from './crdt/types';
import { API_BASE_URL } from './config';

const CLIENT_ID = uuid();

const getWsUrl = () => {
  const backendUrl = API_BASE_URL || `${window.location.protocol}//${window.location.host}`;
  const wsUrl = backendUrl.replace(/^http/, 'ws');
  return `${wsUrl}/ws`;
};

const CURSOR_COLORS = [
  '#3b82f6', 
  '#10b981', 
  '#f59e0b', 
  '#ef4444', 
  '#8b5cf6', 
  '#ec4899', 
];

interface DocMeta {
  id: string;
  createdAt: string;
}

interface RemoteCursor {
  clientId: string;
  position: number;
  color: string;
}

function CursorOverlay({
  text,
  cursors,
  textareaRef,
}: {
  text: string;
  cursors: Map<string, RemoteCursor>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const [cursorPositions, setCursorPositions] = useState<
    { clientId: string; top: number; left: number; color: string }[]
  >([]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const computePositions = () => {
      const positions: { clientId: string; top: number; left: number; color: string }[] = [];
      const style = getComputedStyle(textarea);
      const lineHeight = parseFloat(style.lineHeight) || 24;
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const fontSize = parseFloat(style.fontSize) || 16;

      const charWidth = fontSize * 0.6;

      cursors.forEach((cursor) => {
        const textBefore = text.slice(0, cursor.position);
        const lines = textBefore.split('\n');
        const lineIndex = lines.length - 1;
        const colIndex = lines[lines.length - 1].length;

        const top = paddingTop + lineIndex * lineHeight - textarea.scrollTop;
        const left = paddingLeft + colIndex * charWidth;

        if (top >= 0 && top < textarea.clientHeight) {
          positions.push({
            clientId: cursor.clientId,
            top,
            left,
            color: cursor.color,
          });
        }
      });

      setCursorPositions(positions);
    };

    computePositions();

    textarea.addEventListener('scroll', computePositions);
    return () => textarea.removeEventListener('scroll', computePositions);
  }, [text, cursors, textareaRef]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {cursorPositions.map(({ clientId, top, left, color }) => (
        <div
          key={clientId}
          className="absolute w-0.5 transition-all duration-100"
          style={{
            top: `${top}px`,
            left: `${left}px`,
            height: '1.2em',
            backgroundColor: color,
          }}
        >
          {/* Small label showing user */}
          <div
            className="absolute -top-5 left-0 text-[10px] font-bold px-1 rounded whitespace-nowrap"
            style={{ backgroundColor: color, color: 'white' }}
          >
            User
          </div>
        </div>
      ))}
    </div>
  );
}

function Editor() {
  const { user, logout } = useAuth();
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [text, setText] = useState('');
  const [clients, setClients] = useState<string[]>([]);
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const docRef = useRef(new CRDTDocument());
  const seqRef = useRef(0);
  const prevTextRef = useRef('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const colorMapRef = useRef<Map<string, string>>(new Map());

  const getClientColor = useCallback((clientId: string) => {
    if (!colorMapRef.current.has(clientId)) {
      const index = colorMapRef.current.size % CURSOR_COLORS.length;
      colorMapRef.current.set(clientId, CURSOR_COLORS[index]);
    }
    return colorMapRef.current.get(clientId)!;
  }, []);

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents`, { credentials: 'include' });
      if (!res.ok) return;
      const body = await res.json();
      setDocs(body.data ?? body);
    } catch {
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleMessage = useCallback((data: unknown) => {
    const msg = data as { type: string; [key: string]: unknown };

    if (msg.type === 'init') {
      const crdt = new CRDTDocument();
      const ops = msg.ops as Op[];
      ops.forEach(op => crdt.apply(op));
      docRef.current = crdt;
      const t = crdt.getText();
      setText(t);
      prevTextRef.current = t;

    } else if (msg.type === 'op') {
      const op = msg.op as Op;
      docRef.current.apply(op);
      const t = docRef.current.getText();
      setText(t);
      prevTextRef.current = t;

    } else if (msg.type === 'presence') {
      setClients(msg.clients as string[]);
      setCursors(prev => {
        const updated = new Map(prev);
        const currentClients = new Set(msg.clients as string[]);
        for (const clientId of updated.keys()) {
          if (!currentClients.has(clientId)) {
            updated.delete(clientId);
          }
        }
        return updated;
      });

    } else if (msg.type === 'cursor') {
      const clientId = msg.clientId as string;
      const position = msg.position as number;
      if (clientId !== CLIENT_ID) {
        setCursors(prev => {
          const updated = new Map(prev);
          updated.set(clientId, {
            clientId,
            position,
            color: getClientColor(clientId),
          });
          return updated;
        });
      }

    } else if (msg.type === 'error') {
      console.error('[server error]', msg.message);
    }
  }, [getClientColor]);

  const { send } = useWebSocket(
    activeDocId ? getWsUrl() : null,
    handleMessage,
    () => {
      setWsStatus('connected');
      if (activeDocId) {
        send({ type: 'join', docId: activeDocId, clientId: CLIENT_ID });
      }
    },
    () => setWsStatus('disconnected'),
  );

  useEffect(() => {
    if (!activeDocId) return;
    setWsStatus('connecting');
    docRef.current = new CRDTDocument();
    setText('');
    prevTextRef.current = '';
    setClients([]);
    setCursors(new Map());
    colorMapRef.current.clear();
  }, [activeDocId]);

  useEffect(() => {
    if (wsStatus === 'connected' && activeDocId) {
      send({ type: 'join', docId: activeDocId, clientId: CLIENT_ID });
    }
  }, [wsStatus, activeDocId, send]);

  const createDoc = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/documents`, {
        method: 'POST',
        credentials: 'include',
      });
      const body = await res.json();
      const doc = (body.data ?? body) as DocMeta;
      setDocs(prev => [...prev, doc]);
      setActiveDocId(doc.id);
    } catch (e) {
      console.error('Failed to create document', e);
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!activeDocId) return;
    const newText = e.target.value;
    const oldText = prevTextRef.current;
    const crdt = docRef.current;

    let start = 0;
    while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
      start++;
    }

    const ops: Op[] = [];

    if (newText.length < oldText.length) {
      const deletedCount = oldText.length - newText.length;
      for (let i = 0; i < deletedCount; i++) {
        const charId = crdt.getIdAt(start);
        if (charId) {
          const op: Op = { type: 'delete', id: charId };
          crdt.apply(op);
          ops.push(op);
        }
      }
    } else if (newText.length > oldText.length) {
      const inserted = newText.slice(start, start + (newText.length - oldText.length));
      let afterId = crdt.getAfterIdAt(start);
      for (const ch of inserted) {
        const op: Op = {
          type: 'insert',
          char: {
            id: { clientId: CLIENT_ID, seq: ++seqRef.current },
            value: ch,
            deleted: false,
            after: afterId,
          },
        };
        crdt.apply(op);
        afterId = op.char.id;
        ops.push(op);
      }
    }

    ops.forEach(op => {
      send({ type: 'op', docId: activeDocId, op });
    });

    const t = crdt.getText();
    setText(t);
    prevTextRef.current = t;
  }, [activeDocId, send]);

  const handleSelect = useCallback(() => {
    if (!activeDocId || !textareaRef.current) return;
    const position = textareaRef.current.selectionStart;
    send({ type: 'cursor', docId: activeDocId, position });
  }, [activeDocId, send]);

  return (
    <div className="flex flex-col h-screen bg-[#f5f1e8] text-gray-900">
      <div className="flex flex-1 overflow-hidden">
        {/* Document list */}
        <DocList
          docs={docs}
          activeId={activeDocId}
          onSelect={setActiveDocId}
          onCreate={createDoc}
        />

        {/* Editor area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white border-l-2 border-gray-900">
          {activeDocId ? (
            <>
              {/* Editor toolbar */}
              <div className="flex items-center gap-3 px-4 py-2 border-b-2 border-gray-900 bg-white">
                <span className="text-sm font-bold">Untitled document</span>
                <span className="ml-auto flex items-center gap-4">
                  <button
                    onClick={() => setShowShareModal(true)}
                    className="px-4 py-1.5 text-xs font-bold uppercase tracking-wide bg-[#f4d03f] hover:bg-[#e5c536] transition-colors border-0"
                  >
                    Share
                  </button>
                  <span className="text-xs text-gray-600">{user?.email}</span>
                  <button
                    onClick={logout}
                    className="text-xs text-gray-500 hover:text-gray-900 hover:underline transition-colors"
                  >
                    Logout
                  </button>
                  <span className={`w-2 h-2 rounded-full ${
                    wsStatus === 'connected' ? 'bg-green-500' :
                    wsStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
                  }`} title={wsStatus} />
                </span>
              </div>
              <div className="flex-1 relative overflow-hidden">
                <textarea
                  ref={textareaRef}
                  className="w-full h-full resize-none p-6 text-base text-gray-800 focus:outline-none bg-white font-mono"
                  value={text}
                  onChange={handleChange}
                  onSelect={handleSelect}
                  onKeyUp={handleSelect}
                  onClick={handleSelect}
                  placeholder="Start typing…"
                  spellCheck={false}
                />
                {/* Remote cursor indicators */}
                <CursorOverlay
                  text={text}
                  cursors={cursors}
                  textareaRef={textareaRef}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Select or create a document to start
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-56 shrink-0 border-l border-gray-200 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3">
            <PresenceList
              clients={clients}
              myClientId={CLIENT_ID}
              clientColors={colorMapRef.current}
            />
          </div>
        </div>
      </div>

      {/* Share modal */}
      {showShareModal && activeDocId && (
        <ShareModal
          documentId={activeDocId}
          onClose={() => setShowShareModal(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<'landing' | 'auth' | 'forgot' | 'reset'>('landing');
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && window.location.pathname === '/reset-password') {
      setResetToken(token);
      setAuthView('reset');
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    if (authView === 'reset' && resetToken) {
      return (
        <ResetPasswordPage
          token={resetToken}
          onSuccess={() => {
            setResetToken(null);
            setAuthView('auth');

            window.history.replaceState({}, '', '/');
          }}
          onBack={() => {
            setResetToken(null);
            setAuthView('auth');
            window.history.replaceState({}, '', '/');
          }}
        />
      );
    }

    if (authView === 'forgot') {
      return <ForgotPasswordPage onBack={() => setAuthView('auth')} />;
    }

    if (authView === 'auth') {
      return (
        <AuthPage
          onBack={() => setAuthView('landing')}
          onForgotPassword={() => setAuthView('forgot')}
        />
      );
    }

    return <LandingPage onGetStarted={() => setAuthView('auth')} />;
  }

  return <Editor />;
}
