import { v4 as uuid } from 'uuid';
import { prisma } from '../config/database';
import { store } from '../store/document.store';
import { sendInviteEmail } from './email.service';
import { ErrorMessages } from '../shared/messages';

export class SharingServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'SharingServiceError';
  }
}

export interface InviteResult {
  access: {
    userId: string;
    documentId: string;
    role: string;
  };
}

export interface ShareLinkResult {
  shareUrl: string;
  token: string;
  expiresAt: Date | null;
}

export interface AccessListResult {
  owner: { id: string; email: string };
  collaborators: Array<{
    user: { id: string; email: string };
    role: string;
    grantedAt: Date;
  }>;
}

export async function inviteUser(
  docId: string,
  ownerId: string,
  email: string,
  role: 'editor' | 'viewer'
): Promise<InviteResult> {
  if (!email) {
    throw new SharingServiceError(400, 'Email is required');
  }

  if (role !== 'editor' && role !== 'viewer') {
    throw new SharingServiceError(400, 'Role must be "editor" or "viewer"');
  }

  const isOwner = await store.isOwner(docId, ownerId);
  if (!isOwner) {
    throw new SharingServiceError(403, ErrorMessages.FORBIDDEN);
  }

  const invitee = await prisma.user.findUnique({ where: { email } });
  if (!invitee) {
    throw new SharingServiceError(404, 'User with this email not found');
  }

  const access = await prisma.documentAccess.upsert({
    where: {
      userId_documentId: {
        userId: invitee.id,
        documentId: docId,
      },
    },
    update: { role },
    create: {
      userId: invitee.id,
      documentId: docId,
      role,
    },
  });

  const inviter = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { email: true },
  });

  if (inviter) {
    await sendInviteEmail(email, inviter.email, docId);
  }

  return { access };
}

export async function revokeAccess(
  docId: string,
  ownerId: string,
  targetUserId: string
): Promise<void> {
  const isOwner = await store.isOwner(docId, ownerId);
  if (!isOwner) {
    throw new SharingServiceError(403, ErrorMessages.FORBIDDEN);
  }

  await prisma.documentAccess.deleteMany({
    where: {
      documentId: docId,
      userId: targetUserId,
    },
  });
}

export async function createShareLink(
  docId: string,
  userId: string,
  expiresInDays?: number
): Promise<ShareLinkResult> {
  const hasAccess = await store.hasAccess(docId, userId);
  if (!hasAccess) {
    throw new SharingServiceError(403, ErrorMessages.FORBIDDEN);
  }

  const token = uuid();
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const shareToken = await prisma.shareToken.create({
    data: {
      documentId: docId,
      token,
      expiresAt,
    },
  });

  return {
    shareUrl: `/documents/${docId}/shared/${token}`,
    token: shareToken.token,
    expiresAt: shareToken.expiresAt,
  };
}

export async function getDocumentByShareToken(docId: string, token: string) {
  const shareToken = await prisma.shareToken.findFirst({
    where: {
      documentId: docId,
      token,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  if (!shareToken) {
    throw new SharingServiceError(403, ErrorMessages.INVALID_SHARE_TOKEN);
  }

  const meta = await store.getMeta(docId);
  if (!meta) {
    throw new SharingServiceError(404, ErrorMessages.DOCUMENT_NOT_FOUND);
  }

  const doc = await store.loadDoc(docId);
  return {
    ...meta,
    text: doc?.getText() ?? '',
    readOnly: true,
  };
}

export async function listAccess(
  docId: string,
  userId: string
): Promise<AccessListResult> {
  const hasAccess = await store.hasAccess(docId, userId);
  if (!hasAccess) {
    throw new SharingServiceError(403, ErrorMessages.FORBIDDEN);
  }

  const doc = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      createdAt: true,
      owner: { select: { id: true, email: true } },
      access: {
        select: {
          user: { select: { id: true, email: true } },
          role: true,
          createdAt: true,
        },
      },
    },
  });

  if (!doc) {
    throw new SharingServiceError(404, ErrorMessages.DOCUMENT_NOT_FOUND);
  }

  return {
    owner: doc.owner,
    collaborators: doc.access.map((a) => ({
      user: a.user,
      role: a.role,
      grantedAt: a.createdAt,
    })),
  };
}
