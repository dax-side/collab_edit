import type { Request, Response } from 'express';
import { sendSuccess, sendError } from '../shared/utils/response.util';
import { SuccessMessages, ErrorMessages } from '../shared/messages';
import {
  registerUser,
  loginUser,
  refreshUserTokens,
  getUserById,
  AuthServiceError,
} from '../services/auth.service';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await registerUser(email, password);

    res.cookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    sendSuccess(res, 201, SuccessMessages.USER_REGISTERED, { user: result.user });
  } catch (err) {
    if (err instanceof AuthServiceError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    console.error('Register error:', err);
    sendError(res, 500, ErrorMessages.INTERNAL_ERROR);
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);

    res.cookie('accessToken', result.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', result.refreshToken, COOKIE_OPTIONS);

    sendSuccess(res, 200, SuccessMessages.LOGIN_SUCCESS, { user: result.user });
  } catch (err) {
    if (err instanceof AuthServiceError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    console.error('Login error:', err);
    sendError(res, 500, ErrorMessages.INTERNAL_ERROR);
  }
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');
  sendSuccess(res, 200, SuccessMessages.LOGOUT_SUCCESS, null);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const tokens = await refreshUserTokens(refreshToken);

    res.cookie('accessToken', tokens.accessToken, COOKIE_OPTIONS);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);

    sendSuccess(res, 200, SuccessMessages.TOKEN_REFRESHED, null);
  } catch (err) {
    if (err instanceof AuthServiceError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    sendError(res, 401, ErrorMessages.INVALID_TOKEN);
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const user = await getUserById(req.user!.userId);
    sendSuccess(res, 200, 'User retrieved', { user });
  } catch (err) {
    if (err instanceof AuthServiceError) {
      sendError(res, err.statusCode, err.message);
      return;
    }
    sendError(res, 500, ErrorMessages.INTERNAL_ERROR);
  }
}
