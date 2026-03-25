import bcrypt from 'bcrypt';
import { prisma } from '../config/database';
import { createTokens, refreshTokens as refreshJwtTokens } from '../config/jwt';
import { ErrorMessages } from '../shared/messages';

const SALT_ROUNDS = 10;

export interface UserData {
  id: string;
  email: string;
  createdAt: Date;
}

export interface AuthResult {
  user: UserData;
  accessToken: string;
  refreshToken: string;
}

export class AuthServiceError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

export async function registerUser(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) {
    throw new AuthServiceError(400, 'Email and password are required');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AuthServiceError(409, ErrorMessages.EMAIL_ALREADY_EXISTS);
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: { email, password: hashedPassword },
    select: { id: true, email: true, createdAt: true },
  });


  const { accessToken, refreshToken } = createTokens({
    userId: user.id,
    email: user.email,
  });

  return { user, accessToken, refreshToken };
}

export async function loginUser(email: string, password: string): Promise<AuthResult> {
  if (!email || !password) {
    throw new AuthServiceError(400, 'Email and password are required');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AuthServiceError(401, ErrorMessages.INVALID_CREDENTIALS);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new AuthServiceError(401, ErrorMessages.INVALID_CREDENTIALS);
  }

  const { accessToken, refreshToken } = createTokens({
    userId: user.id,
    email: user.email,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshUserTokens(refreshToken: string) {
  if (!refreshToken) {
    throw new AuthServiceError(401, ErrorMessages.INVALID_TOKEN);
  }

  try {
    return await refreshJwtTokens(refreshToken);
  } catch {
    throw new AuthServiceError(401, ErrorMessages.INVALID_TOKEN);
  }
}

export async function getUserById(userId: string): Promise<UserData> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, createdAt: true },
  });

  if (!user) {
    throw new AuthServiceError(404, ErrorMessages.USER_NOT_FOUND);
  }

  return user;
}
