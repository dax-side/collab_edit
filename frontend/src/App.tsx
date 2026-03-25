import { useEffect, useRef, useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { DocList } from './components/DocList';
import { PresenceList } from './components/PresenceList';
import { AuthPage } from './components/AuthPage';
import { LandingPage } from './components/LandingPage';
import { ShareModal } from './components/ShareModal';
import { useWebSocket } from './hooks/useWebSocket';
import { useAuth } from './hooks/useAuth';
import { CRDTDocument } from './crdt/document';
import { type Op } from './crdt/types';

const CLIENT_ID = uuid();
const WS_URL = `ws://localhost:3000/ws`;

interface DocMeta {
  id: string;
  createdAt: string;
}

function Editor() {
  const { user, logout } = useAuth();
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [text, setText] = useState('');
  const [clients, setClients] = useState<string[]>([]);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const docRef = useRef(new CRDTDocument());
  const seqRef = useRef(0);
  const prevTextRef = useRef('');

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch('/documents', { credentials: 'include' });
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

    } else if (msg.type === 'error') {
      console.error('[server error]', msg.message);
    }
  }, []);

  const { send } = useWebSocket(
    activeDocId ? WS_URL : null,
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
  }, [activeDocId]);

  useEffect(() => {
    if (wsStatus === 'connected' && activeDocId) {
      send({ type: 'join', docId: activeDocId, clientId: CLIENT_ID });
    }
  }, [wsStatus, activeDocId, send]);

  const createDoc = useCallback(async () => {
    try {
      const res = await fetch('/documents', {
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
              <textarea
                className="flex-1 resize-none p-6 text-base text-gray-800 focus:outline-none bg-white"
                value={text}
                onChange={handleChange}
                placeholder="Start typing…"
                spellCheck={false}
              />
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
            <PresenceList clients={clients} myClientId={CLIENT_ID} />
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
  const [showAuth, setShowAuth] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    if (!showAuth) {
      return <LandingPage onGetStarted={() => setShowAuth(true)} />;
    }
    return <AuthPage onBack={() => setShowAuth(false)} />;
  }

  return <Editor />;
}
