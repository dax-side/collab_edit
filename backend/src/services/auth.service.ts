import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { createTokens, refreshTokens as refreshJwtTokens } from '../config/jwt';
import { ErrorMessages } from '../shared/messages';
import { logger } from '../shared/utils/logger';
import { sendPasswordResetEmail } from './email.service';

const SALT_ROUNDS = 10;
const RESET_TOKEN_BYTES = 32;
const DEFAULT_RESET_TOKEN_EXPIRY_MINUTES = 60;
const parsedResetTokenExpiryMinutes = Number.parseInt(
  process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES ?? `${DEFAULT_RESET_TOKEN_EXPIRY_MINUTES}`,
  10,
);
const RESET_TOKEN_EXPIRY_MINUTES = Number.isFinite(parsedResetTokenExpiryMinutes) && parsedResetTokenExpiryMinutes > 0
  ? parsedResetTokenExpiryMinutes
  : DEFAULT_RESET_TOKEN_EXPIRY_MINUTES;

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isResetTokenExpired(createdAt: Date): boolean {
  const expiresAt = createdAt.getTime() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000;
  return Date.now() > expiresAt;
}

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

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id },
  });

  const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex');
  const tokenHash = hashResetToken(token);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
    },
  });

  // Do not block HTTP response on SMTP latency.
  void sendPasswordResetEmail(email, token, RESET_TOKEN_EXPIRY_MINUTES)
    .then((sent) => {
      if (!sent) {
        logger.warn(`Password reset email was not sent for ${email}`);
      }
    })
    .catch((err) => {
      logger.error(`Unexpected password reset email error for ${email}:`, err);
    });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  if (!token || !newPassword) {
    throw new AuthServiceError(400, 'Token and new password are required');
  }

  if (newPassword.length < 6) {
    throw new AuthServiceError(400, 'Password must be at least 6 characters');
  }

  const tokenHash = hashResetToken(token);

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetToken) {
    throw new AuthServiceError(400, 'Invalid reset token');
  }

  if (isResetTokenExpired(resetToken.createdAt)) {
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } }).catch(() => undefined);
    throw new AuthServiceError(400, ErrorMessages.INVALID_TOKEN);
  }

  const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.delete({
      where: { id: resetToken.id },
    }),
  ]);
}
