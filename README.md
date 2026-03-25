# CollabEdit

A real-time collaborative text editor with a custom CRDT implementation. No Yjs, no Automerge—just a clean RGA-based conflict resolution system built from first principles.

## Why This Exists

Most collaborative editing tutorials reach for Yjs and call it a day. This project takes a different path: implementing the CRDT layer from scratch to understand exactly how conflict-free replication works.

The result is a system where multiple users can edit the same document simultaneously, offline edits sync cleanly, and the document always converges to the same state—regardless of network conditions or operation order.

## How the CRDT Works

The editor uses a **Replicated Growable Array (RGA)** approach. Every character gets a globally unique ID:

```typescript
interface CharId {
  clientId: string;  // UUID per browser session
  seq: number;       // Incrementing counter per client
}
```

When you type, an insert operation is created referencing the character it should appear *after*:

```typescript
{
  type: 'insert',
  char: {
    id: { clientId: 'abc123', seq: 42 },
    value: 'x',
    after: { clientId: 'def456', seq: 17 }  // anchor point
  }
}
```

Deletions don't remove characters—they mark them as tombstones. This matters because a late-arriving insert might reference a deleted character as its anchor. Tombstones ensure that insert can still find its position.

When two users insert at the same position simultaneously, the tie-breaker is deterministic: compare `clientId` strings, then `seq` numbers. Every replica applies the same rule, so every replica converges.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  React UI    │  │  CRDT Doc    │  │  WebSocket Hook      │   │
│  │  (textarea)  │──│  (same impl) │──│  (send ops, cursors) │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Backend                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  WS Handler  │──│  Doc Store   │──│  PostgreSQL          │   │
│  │  (broadcast) │  │  (CRDT cache)│  │  (ops log + users)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Express API │──│  Services    │──│  JWT Auth            │   │
│  │  (REST)      │  │  (business)  │  │  (httpOnly cookies)  │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

The CRDT implementation is duplicated between frontend and backend—same algorithm, slightly different interfaces. The backend version tracks an operation log for persistence; the frontend version adds cursor-position helpers.

## The Operation Queue (Why Paste Works)

Early versions had a bug: pasting text would scramble on other clients. The cause was subtle.

When you paste "hello", the editor generates five insert operations in rapid succession. Without coordination, these operations could interleave with database writes and broadcasts in unpredictable ways. Client B would receive ops out of order and end up with "hleol" or worse.

The fix is a per-document operation queue:

```typescript
async applyAndPersist(docId: string, op: Op): Promise<boolean> {
  const prevQueue = this.opQueues.get(docId) ?? Promise.resolve();

  const newQueue = prevQueue.then(async () => {
    doc.apply(op);
    await prisma.op.create({ ... });
    broadcast(op);
  });

  this.opQueues.set(docId, newQueue);
}
```

Each document has its own promise chain. Operations are processed strictly in arrival order. Paste works.

## Authentication

JWT tokens stored in httpOnly cookies—not localStorage. This prevents XSS attacks from stealing tokens.

```typescript
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
};
```

The auth flow:
1. Login/register returns user data and sets cookies
2. Every subsequent request includes cookies automatically
3. Middleware extracts and verifies the access token
4. Protected routes get `req.user` with userId and email

Token refresh happens via `/auth/refresh`. The refresh token has a longer TTL (7 days vs 15 minutes for access tokens).

## Sharing System

Two mechanisms:

**Direct invites** (for registered users)
- Owner enters an email address
- System creates a `DocumentAccess` record with role (editor/viewer)
- Sends an email notification via nodemailer

**Share links** (for anyone)
- Owner generates a read-only link with optional expiration
- Link contains a UUID token
- Anyone with the link can view (not edit)

Access control checks happen at both HTTP and WebSocket layers. You can't join a document's WebSocket room without permission.

## API

**Auth**
- `POST /auth/register` - Create account
- `POST /auth/login` - Sign in (sets cookies)
- `POST /auth/logout` - Clear cookies
- `POST /auth/refresh` - Refresh tokens
- `GET /auth/me` - Current user (protected)

**Documents**
- `GET /documents` - List your documents
- `POST /documents` - Create new
- `GET /documents/:id` - Get document

**Sharing**
- `POST /documents/:id/invite` - Invite by email
- `DELETE /documents/:id/access/:userId` - Revoke access
- `POST /documents/:id/share` - Generate share link
- `GET /documents/:id/shared/:token` - Access via link
- `GET /documents/:id/access` - List collaborators

**WebSocket** (`ws://localhost:3000/ws`)
- `{ type: 'join', docId, clientId }` - Join document
- `{ type: 'op', docId, op }` - Send operation
- `{ type: 'cursor', docId, position }` - Update cursor

## What's Different About This Backend

**No CRDT library.** The RGA implementation is ~200 lines of TypeScript. Understanding happens by building.

**Operation queue per document.** Most tutorials skip this. Real-world collaborative editing breaks without it.

**Tombstone retention.** Deleted characters stay forever. Late arrivals can still find their anchors.

**httpOnly cookies.** Tokens never touch JavaScript. XSS can't steal them.

**Clean separation.** Routes define endpoints. Controllers handle HTTP. Services contain logic. Store manages data. Each layer does one thing.

**Centralized messages.** Every user-facing string lives in one place. Change the error message once, it updates everywhere.

## What's Left

- **Cursor rendering** - Backend broadcasts cursor positions, frontend doesn't show them yet
- **Rich text** - Currently plain text only
- **Redis pub/sub** - For multi-server deployment
- **Undo/redo** - Would require tracking inverse operations

## License

MIT
