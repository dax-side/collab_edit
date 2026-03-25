import WebSocket from 'ws';
import { store } from '../store/document.store';
import { type ClientMessage, type ServerMessage, type PresenceMessage } from '../types/messages';
import { ErrorMessages } from '../shared/messages';
import { logger } from '../shared/utils/logger';

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
      broadcastPresence(docId);
      logger.info(`client ${clientId.slice(0, 8)} joined doc ${docId.slice(0, 8)}`);
      break;
    }

    case 'op': {
      const { docId, op } = msg;
      const sender = store.getClients(docId).find(c => c.ws === ws);
      const clientId = sender?.clientId ?? 'unknown';

      const ok = await store.applyAndPersist(docId, op);
      if (!ok) {
        send(ws, { type: 'error', message: ErrorMessages.DOCUMENT_APPLY_FAILED });
        return;
      }

      broadcast(docId, { type: 'op', docId, op, clientId }, ws);
      break;
    }

    case 'cursor': {
      const { docId, position } = msg;
      const sender = store.getClients(docId).find(c => c.ws === ws);
      if (!sender) return;

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
    broadcastPresence(docId);
    logger.info(`client ${clientId.slice(0, 8)} left doc ${docId.slice(0, 8)}`);
  }
}
