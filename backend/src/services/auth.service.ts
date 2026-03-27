import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { createTokens, refreshTokens as refreshJwtTokens } from '../config/jwt';
import { ErrorMessages } from '../shared/messages';
import { sendPasswordResetEmail } from './email.service';

const SALT_ROUNDS = 10;
const RESET_TOKEN_EXPIRY_HOURS = 1;

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

export async function requestPasswordReset(email: string): Promise<void> {
  if (!email) {
    throw new AuthServiceError(400, 'Email is required');
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return;
  }

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  await sendPasswordResetEmail(email, token);
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token || !newPassword) {
    throw new AuthServiceError(400, 'Token and new password are required');
  }

  if (newPassword.length < 6) {
    throw new AuthServiceError(400, 'Password must be at least 6 characters');
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!resetToken) {
    throw new AuthServiceError(400, 'Invalid or expired reset token');
  }

  if (resetToken.usedAt) {
    throw new AuthServiceError(400, 'This reset link has already been used');
  }

  if (resetToken.expiresAt < new Date()) {
    throw new AuthServiceError(400, 'This reset link has expired');
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);
}
