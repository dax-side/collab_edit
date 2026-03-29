import 'dotenv/config';
import express, { type Request, type Response, type NextFunction } from 'express';
import http from 'http';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';
import { store } from './store/document.store';
import { handleMessage, handleDisconnect } from './websocket/handlers';
import { logger, morganStream } from './shared/utils/logger';
import { AppError } from './shared/errors';
import { ErrorMessages, SuccessMessages } from './shared/messages';
import { sendSuccess, sendError } from './shared/utils/response.util';
import { authRouter } from './routes/auth.routes';
import { sharingRouter } from './routes/sharing.routes';
import { authenticate } from './middleware/auth.middleware';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(morgan('short', { stream: morganStream }));
app.use('/auth', authRouter);
app.use('/', sharingRouter);

app.post('/documents', authenticate, async (req, res) => {
  const userId = req.user!.userId;
  const doc = await store.create(userId);
  sendSuccess(res, 201, SuccessMessages.DOCUMENT_CREATED, doc);
});

app.get('/documents', authenticate, async (req, res) => {
  const userId = req.user!.userId;
  const docs = await store.list(userId);
  sendSuccess(res, 200, SuccessMessages.DOCUMENTS_LISTED, docs);
});

app.get('/documents/:id', authenticate, async (req, res) => {
  const userId = req.user!.userId;
  const docId = req.params.id as string;

  const hasAccess = await store.hasAccess(docId, userId);
  if (!hasAccess) {
    sendError(res, 403, ErrorMessages.FORBIDDEN);
    return;
  }

  const meta = await store.getMeta(docId);
  if (!meta) {
    sendError(res, 404, ErrorMessages.DOCUMENT_NOT_FOUND);
    return;
  }

  const doc = await store.loadDoc(docId);
  sendSuccess(res, 200, SuccessMessages.DOCUMENT_RETRIEVED, {
    ...meta,
    text: doc?.getText() ?? '',
    clients: store.getClientIds(docId),
  });
});

app.delete('/documents/:id', authenticate, async (req, res) => {
  const userId = req.user!.userId;
  const docId = req.params.id as string;

  const isOwner = await store.isOwner(docId, userId);
  if (!isOwner) {
    sendError(res, 403, ErrorMessages.FORBIDDEN);
    return;
  }

  const deleted = await store.delete(docId);
  if (!deleted) {
    sendError(res, 404, ErrorMessages.DOCUMENT_NOT_FOUND);
    return;
  }
  res.status(204).send();
});


app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message);
    return;
  }
  logger.error(err);
  sendError(res, 500, ErrorMessages.INTERNAL_ERROR);
});

const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    handleMessage(ws, data.toString()).catch(err => {
      logger.error('ws handler error', err);
    });
  });
  ws.on('close', () => handleDisconnect(ws));
  ws.on('error', (err) => {
    logger.error('ws socket error', err);
    handleDisconnect(ws);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`CollabEdit server running on http://0.0.0.0:${PORT}`);
  logger.info(`WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
});

export { httpServer, wss };
