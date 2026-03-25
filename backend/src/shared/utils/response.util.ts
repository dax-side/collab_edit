import { type Response } from 'express';

interface SuccessPayload<T = unknown> {
  success: true;
  message: string;
  data: T;
}

interface ErrorPayload {
  success: false;
  message: string;
}

export function sendSuccess<T>(res: Response, statusCode: number, message: string, data: T): void {
  const payload: SuccessPayload<T> = { success: true, message, data };
  res.status(statusCode).json(payload);
}

export function sendError(res: Response, statusCode: number, message: string): void {
  const payload: ErrorPayload = { success: false, message };
  res.status(statusCode).json(payload);
}
