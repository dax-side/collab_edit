import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../shared/utils/response.util';
import { SuccessMessages, ErrorMessages } from '../shared/messages';
import {
  inviteUser,
  revokeAccess,
  createShareLink,
  getDocumentByShareToken,
  listAccess,
  SharingServiceError,
} from '../services/sharing.service';

export async function invite(req: Request, res: Response): Promise<void> {
  try {
    const docId = req.params.id as string;
    const userId = req.user!.userId;
    const { email, role = 'editor' } = req.body;

    const result = await inviteUser(docId, userId, email, role);
    sendSuccess(res, 200, SuccessMessages.ACCESS_GRANTED, result);
  } catch (err) {
    if (err instanceof SharingServiceError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    console.error('Invite error:', err);
    sendError(res, 500, ErrorMessages.INTERNAL_ERROR);
  }
}

export async function revoke(req: Request, res: Response): Promise<void> {
  try {
    const docId = req.params.id as string;
    const ownerId = req.user!.userId;
    const targetUserId = req.params.userId as string;

    await revokeAccess(docId, ownerId, targetUserId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof SharingServiceError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    console.error('Revoke access error:', err);
    sendError(res, 500, ErrorMessages.INTERNAL_ERROR);
  }
}

export async function createLink(req: Request, res: Response): Promise<void> {
  try {
    const docId = req.params.id as string;
    const userId = req.user!.userId;
    const { expiresInDays } = req.body;

    const result = await createShareLink(docId, userId, expiresInDays);
    sendSuccess(res, 201, SuccessMessages.SHARE_LINK_CREATED, result);
  } catch (err) {
    if (err instanceof SharingServiceError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    console.error('Share link error:', err);
    sendError(res, 500, ErrorMessages.INTERNAL_ERROR);
  }
}

export async function getShared(req: Request, res: Response): Promise<void> {
  try {
    const docId = req.params.id as string;
    const token = req.params.token as string;

    const result = await getDocumentByShareToken(docId, token);
    sendSuccess(res, 200, SuccessMessages.DOCUMENT_RETRIEVED, result);
  } catch (err) {
    if (err instanceof SharingServiceError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    console.error('Shared document access error:', err);
    sendError(res, 500, ErrorMessages.INTERNAL_ERROR);
  }
}

export async function getAccessList(req: Request, res: Response): Promise<void> {
  try {
    const docId = req.params.id as string;
    const userId = req.user!.userId;

    const result = await listAccess(docId, userId);
    sendSuccess(res, 200, 'Access list retrieved', result);
  } catch (err) {
    if (err instanceof SharingServiceError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    console.error('List access error:', err);
    sendError(res, 500, ErrorMessages.INTERNAL_ERROR);
  }
}
