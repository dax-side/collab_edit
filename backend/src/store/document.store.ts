import { CRDTDocument } from '../crdt/document';
import { type Op } from '../crdt/types';
import WebSocket from 'ws';
import { prisma } from '../config/database';
import { logger } from '../shared/utils/logger';

export interface DocumentMeta {
  id: string;
  createdAt: Date;
}

export interface ConnectedClient {
  clientId: string;
  ws: WebSocket;
}

class DocumentStore {
  private crdtCache: Map<string, CRDTDocument> = new Map();
  private connections: Map<string, ConnectedClient[]> = new Map();
  private opQueues: Map<string, Promise<void>> = new Map();
  private socketMembership: Map<WebSocket, { docId: string; clientId: string }> = new Map();

  private detachSocket(ws: WebSocket): { docId: string; clientId: string } | undefined {
    const existing = this.socketMembership.get(ws);
    if (!existing) return undefined;

    const clients = this.connections.get(existing.docId) ?? [];
    this.connections.set(existing.docId, clients.filter(client => client.ws !== ws));
    this.socketMembership.delete(ws);
    return existing;
  }


  async create(userId: string): Promise<DocumentMeta> {
    const doc = await prisma.document.create({
      data: { ownerId: userId },
      select: { id: true, createdAt: true },
    });
    this.crdtCache.set(doc.id, new CRDTDocument());
    this.connections.set(doc.id, []);
    return doc;
  }

  getCached(id: string): CRDTDocument | undefined {
    return this.crdtCache.get(id);
  }

  async loadDoc(id: string): Promise<CRDTDocument | undefined> {
    if (this.crdtCache.has(id)) return this.crdtCache.get(id);

    const exists = await prisma.document.findUnique({ where: { id } });
    if (!exists) return undefined;

    const opRows = await prisma.op.findMany({
      where: { docId: id },
      orderBy: { id: 'asc' },
      select: { op: true },
    });

    const doc = new CRDTDocument();
    for (const row of opRows) doc.apply(row.op as unknown as Op);

    this.crdtCache.set(id, doc);
    if (!this.connections.has(id)) this.connections.set(id, []);
    logger.debug(`loaded doc ${id} with ${opRows.length} ops from Postgres`);
    return doc;
  }

  async getMeta(id: string): Promise<DocumentMeta | undefined> {
    const doc = await prisma.document.findUnique({
      where: { id },
      select: { id: true, createdAt: true },
    });
    return doc ?? undefined;
  }

  async list(userId: string): Promise<DocumentMeta[]> {
    const [ownedDocs, sharedDocs] = await Promise.all([
      prisma.document.findMany({
        where: { ownerId: userId },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.findMany({
        where: { access: { some: { userId } } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const docsById = new Map<string, DocumentMeta>();
    for (const doc of ownedDocs) docsById.set(doc.id, doc);
    for (const doc of sharedDocs) {
      if (!docsById.has(doc.id)) docsById.set(doc.id, doc);
    }

    return [...docsById.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getAccessibleMeta(docId: string, userId: string): Promise<DocumentMeta | undefined> {
    const doc = await prisma.document.findFirst({
      where: {
        id: docId,
        OR: [
          { ownerId: userId },
          { access: { some: { userId } } },
        ],
      },
      select: { id: true, createdAt: true },
    });

    return doc ?? undefined;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await prisma.document.delete({ where: { id } });
      this.crdtCache.delete(id);
      this.connections.delete(id);
      this.opQueues.delete(id);
      for (const [ws, membership] of this.socketMembership.entries()) {
        if (membership.docId === id) {
          this.socketMembership.delete(ws);
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  async join(docId: string, clientId: string, ws: WebSocket): Promise<boolean> {
    const doc = await this.loadDoc(docId);
    if (!doc) return false;

    this.detachSocket(ws);

    const clients = this.connections.get(docId) ?? [];
    const filtered = clients.filter(c => c.clientId !== clientId && c.ws !== ws);
    filtered.push({ clientId, ws });
    this.connections.set(docId, filtered);
    this.socketMembership.set(ws, { docId, clientId });
    return true;
  }

  async applyAndPersist(docId: string, op: Op): Promise<boolean> {
    return this.applyAndPersistMany(docId, [op]);
  }

  async applyAndPersistMany(docId: string, ops: Op[]): Promise<boolean> {
    if (ops.length === 0) return true;

    const prevQueue = this.opQueues.get(docId) ?? Promise.resolve();

    let resolveResult: (value: boolean) => void;
    const resultPromise = new Promise<boolean>((resolve) => {
      resolveResult = resolve;
    });

    const newQueue = prevQueue.then(async () => {
      try {
        const doc = this.crdtCache.get(docId);
        if (!doc) {
          resolveResult(false);
          return;
        }

        for (const op of ops) {
          doc.apply(op);
        }

        await prisma.op.createMany({
          data: ops.map((op) => ({
            docId,
            op: JSON.parse(JSON.stringify(op)),
          })),
        });
        resolveResult(true);
      } catch (err) {
        logger.error(`Error processing ${ops.length} ops for doc ${docId}:`, err);
        resolveResult(false);
      }
    });

    this.opQueues.set(docId, newQueue);

    return resultPromise;
  }

  leave(ws: WebSocket): { docId: string; clientId: string }[] {
    const removed = this.detachSocket(ws);
    return removed ? [removed] : [];
  }

  getClientBySocket(ws: WebSocket): { docId: string; clientId: string } | undefined {
    return this.socketMembership.get(ws);
  }

  getClients(docId: string): ConnectedClient[] {
    return this.connections.get(docId) ?? [];
  }

  getClientIds(docId: string): string[] {
    return this.getClients(docId).map(c => c.clientId);
  }

  async hasAccess(docId: string, userId: string): Promise<boolean> {
    const doc = await prisma.document.findFirst({
      where: {
        id: docId,
        OR: [
          { ownerId: userId },
          { access: { some: { userId } } },
        ],
      },
    });
    return doc !== null;
  }

  async isOwner(docId: string, userId: string): Promise<boolean> {
    const doc = await prisma.document.findFirst({
      where: { id: docId, ownerId: userId },
    });
    return doc !== null;
  }

  async getRole(docId: string, userId: string): Promise<'owner' | 'editor' | 'viewer' | null> {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      include: { access: { where: { userId } } },
    });

    if (!doc) return null;
    if (doc.ownerId === userId) return 'owner';
    if (doc.access.length > 0) return doc.access[0].role as 'editor' | 'viewer';
    return null;
  }
}

export const store = new DocumentStore();
