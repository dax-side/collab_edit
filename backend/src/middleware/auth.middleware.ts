import { type Request, type Response, type NextFunction } from 'express';
import { verifyAccessToken, type TokenPayload } from '../config/jwt';
import { sendError } from '../shared/utils/response.util';
import { ErrorMessages } from '../shared/messages';

declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.accessToken;

    if (!token) {
      sendError(res, 401, ErrorMessages.UNAUTHORIZED);
      return;
    }

    const payload = await verifyAccessToken(token);
    (req as any).user = payload;
    next();
  } catch (err) {
    sendError(res, 401, ErrorMessages.UNAUTHORIZED);
  }
}

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.accessToken;
    if (token) {
      const payload = await verifyAccessToken(token);
      (req as any).user = payload;
    }
  } catch {

  }
  next();
}
