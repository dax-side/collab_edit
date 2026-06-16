import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { logger } from '../shared/utils/logger';

const connectionString = process.env.DATABASE_URL;

const PG_POOL_MAX = Number.parseInt(process.env.PG_POOL_MAX ?? '10', 10);
const PG_CONNECTION_TIMEOUT_MS = Number.parseInt(process.env.PG_CONNECTION_TIMEOUT_MS ?? '15000', 10);
const PG_IDLE_TIMEOUT_MS = Number.parseInt(process.env.PG_IDLE_TIMEOUT_MS ?? '30000', 10);

const pool = new pg.Pool({
	connectionString,
	max: Number.isFinite(PG_POOL_MAX) ? PG_POOL_MAX : 10,
	connectionTimeoutMillis: Number.isFinite(PG_CONNECTION_TIMEOUT_MS) ? PG_CONNECTION_TIMEOUT_MS : 15000,
	idleTimeoutMillis: Number.isFinite(PG_IDLE_TIMEOUT_MS) ? PG_IDLE_TIMEOUT_MS : 30000,
	keepAlive: true,
	keepAliveInitialDelayMillis: 10000,
});

const adapter = new PrismaPg(pool as any);

const RETRYABLE_ERROR_CODES = new Set([
	'ETIMEDOUT',
	'ECONNRESET',
	'ENETUNREACH',
	'EHOSTUNREACH',
]);

const RETRYABLE_READ_OPERATIONS = new Set([
	'findUnique',
	'findUniqueOrThrow',
	'findFirst',
	'findFirstOrThrow',
	'findMany',
	'count',
	'aggregate',
	'groupBy',
]);

const READ_RETRY_ATTEMPTS = Number.parseInt(process.env.DB_READ_RETRY_ATTEMPTS ?? '3', 10);
const READ_RETRY_BASE_DELAY_MS = Number.parseInt(process.env.DB_READ_RETRY_BASE_DELAY_MS ?? '150', 10);

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractErrorCode(error: unknown): string | undefined {
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		return error.code;
	}

	if (error instanceof Error) {
		const maybeCode = (error as Error & { code?: unknown }).code;
		return typeof maybeCode === 'string' ? maybeCode : undefined;
	}

	return undefined;
}

function isRetryableReadError(error: unknown): boolean {
	const code = extractErrorCode(error);
	if (code && RETRYABLE_ERROR_CODES.has(code)) return true;

	if (error instanceof Error) {
		return /ETIMEDOUT|ECONNRESET|ENETUNREACH|EHOSTUNREACH/i.test(error.message);
	}

	return false;
}

const prismaClient = new PrismaClient({ adapter });

const prismaWithRetry = prismaClient.$extends({
	query: {
		$allModels: {
			async $allOperations({ model, operation, args, query }) {
				if (!RETRYABLE_READ_OPERATIONS.has(operation)) {
					return query(args);
				}

				const maxAttempts = Number.isFinite(READ_RETRY_ATTEMPTS) && READ_RETRY_ATTEMPTS > 0
					? READ_RETRY_ATTEMPTS
					: 2;

				const baseDelayMs = Number.isFinite(READ_RETRY_BASE_DELAY_MS) && READ_RETRY_BASE_DELAY_MS > 0
					? READ_RETRY_BASE_DELAY_MS
					: 150;

				let attempt = 1;
				while (true) {
					try {
						return await query(args);
					} catch (error) {
						if (attempt >= maxAttempts || !isRetryableReadError(error)) {
							throw error;
						}

						const code = extractErrorCode(error) ?? 'unknown';
						const modelName = typeof model === 'string' ? model : 'unknownModel';
						logger.warn(
							`Transient DB error on ${modelName}.${operation} (code=${code}), retrying (${attempt + 1}/${maxAttempts})`,
						);

						await sleep(baseDelayMs * attempt);
						attempt++;
					}
				}
			},
		},
	},
});

export const prisma = prismaWithRetry;
