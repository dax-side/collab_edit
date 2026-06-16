import WebSocket from 'ws';
import { store } from '../store/document.store';
import { type ClientMessage, type ServerMessage, type PresenceMessage } from '../types/messages';
import { ErrorMessages } from '../shared/messages';
import { logger } from '../shared/utils/logger';

const PRESENCE_DEBOUNCE_MS = 40;
const pendingPresenceBroadcasts = new Map<string, NodeJS.Timeout>();

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcast(docId: string, msg: ServerMessage, except?: WebSocket): void {
  for (const { ws } of store.getClients(docId)) {
    if (ws !== except) send(ws, msg);
  }
}

function broadcastPresence(docId: string): void {
  const presence: PresenceMessage = {
    type: 'presence',
    docId,
    clients: store.getClientIds(docId),
  };
  for (const { ws } of store.getClients(docId)) {
    send(ws, presence);
  }
}

function schedulePresenceBroadcast(docId: string): void {
  if (pendingPresenceBroadcasts.has(docId)) return;

  const timer = setTimeout(() => {
    pendingPresenceBroadcasts.delete(docId);
    broadcastPresence(docId);
  }, PRESENCE_DEBOUNCE_MS);

  pendingPresenceBroadcasts.set(docId, timer);
}

export async function handleMessage(ws: WebSocket, raw: string): Promise<void> {
  let msg: ClientMessage;
  try {
    msg = JSON.parse(raw) as ClientMessage;
  } catch {
    send(ws, { type: 'error', message: ErrorMessages.INVALID_JSON });
    return;
  }

  switch (msg.type) {
    case 'join': {
      const { docId, clientId } = msg;
      const joined = await store.join(docId, clientId, ws);

      if (!joined) {
        send(ws, { type: 'error', message: ErrorMessages.DOCUMENT_NOT_FOUND });
        return;
      }

      const doc = store.getCached(docId)!;
      send(ws, { type: 'init', docId, ops: doc.getOps() });
      schedulePresenceBroadcast(docId);
      logger.info(`client ${clientId.slice(0, 8)} joined doc ${docId.slice(0, 8)}`);
      break;
    }

    case 'op':
    case 'ops': {
      const docId = msg.docId;
      const ops = msg.type === 'op' ? [msg.op] : msg.ops;
      if (ops.length === 0) return;

      const sender = store.getClientBySocket(ws);
      if (!sender || sender.docId !== docId) {
        send(ws, { type: 'error', message: ErrorMessages.FORBIDDEN });
        return;
      }

      const clientId = sender.clientId;

      const ok = await store.applyAndPersistMany(docId, ops);
      if (!ok) {
        send(ws, { type: 'error', message: ErrorMessages.DOCUMENT_APPLY_FAILED });
        return;
      }

      if (ops.length === 1) {
        broadcast(docId, { type: 'op', docId, op: ops[0], clientId }, ws);
      } else {
        broadcast(docId, { type: 'ops', docId, ops, clientId }, ws);
      }
      break;
    }

    case 'cursor': {
      const { docId, position } = msg;
      const sender = store.getClientBySocket(ws);
      if (!sender || sender.docId !== docId) return;

      broadcast(docId, { type: 'cursor', docId, clientId: sender.clientId, position }, ws);
      break;
    }

    default: {
      send(ws, { type: 'error', message: ErrorMessages.UNKNOWN_MESSAGE_TYPE });
    }
  }
}

export function handleDisconnect(ws: WebSocket): void {
  const removed = store.leave(ws);
  for (const { docId, clientId } of removed) {
    schedulePresenceBroadcast(docId);
    logger.info(`client ${clientId.slice(0, 8)} left doc ${docId.slice(0, 8)}`);
  }
}
