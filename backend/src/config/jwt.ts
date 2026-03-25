import { useJwt } from '@dax-side/jwt-abstraction';

const accessSecret = process.env.JWT_ACCESS_SECRET;
const refreshSecret = process.env.JWT_REFRESH_SECRET;

if (!accessSecret || !refreshSecret) {
  throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set in environment');
}

export const jwt = useJwt({
  secret: accessSecret,
  refreshTokenSecret: refreshSecret,
  accessTokenTTL: '15m',   
  refreshTokenTTL: '7d',   
});

export interface TokenPayload {
  userId: string;
  email: string;
}

export function createTokens(payload: TokenPayload) {
  return jwt.create(payload);
}

export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const payload = await jwt.verify(token);
  return {
    userId: payload.userId as string,
    email: payload.email as string,
  };
}

export async function refreshTokens(refreshToken: string) {
  return jwt.refresh(refreshToken);
}
