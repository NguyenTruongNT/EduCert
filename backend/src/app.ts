import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import multer from 'multer';
import type Database from 'better-sqlite3';
import { type AppConfig, MAX_PDF_BYTES } from './config.js';
import { openDatabase } from './database.js';
import { ApiError } from './errors.js';
import { ChainService } from './services/chain.js';
import { createAuth } from './auth.js';

export function createApp(config: AppConfig, database?: Database.Database) {
  const db = database ?? openDatabase(config.databasePath);
  const chain = new ChainService(config);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) callback(null, true);
      else callback(new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'));
    },
    credentials: true, methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  }));
  app.use(express.json({ limit: '64kb' }));
  app.use(cookieParser());
  app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  const api = express.Router();
  app.use('/api/v1', api);
  api.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
  api.get('/config', (_req, res) => res.json({ success: true, data: {
    chainId: config.chainId, contractAddress: config.contractAddress, abi: config.abi,
    publicAppUrl: config.publicAppUrl, maxPdfBytes: MAX_PDF_BYTES,
  } }));
  const auth = createAuth(config, db, chain);
  auth.mount(api);

  app.use((_req, _res, next) => next(new ApiError(404, 'ROUTE_NOT_FOUND', 'Route not found')));
  app.use(errorHandler);
  return { app, db, chain };
}

const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  let failure: ApiError;
  if (error instanceof ApiError) failure = error;
  else if (error instanceof ZodError) failure = new ApiError(400, 'VALIDATION_ERROR', error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  else if (error instanceof multer.MulterError) failure = new ApiError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR', error.message);
  else if (typeof error === 'object' && error !== null && 'type' in error && error.type === 'entity.too.large') failure = new ApiError(413, 'REQUEST_TOO_LARGE', 'Request is too large');
  else if (error instanceof SyntaxError && 'body' in error) failure = new ApiError(400, 'INVALID_JSON', 'Request body is not valid JSON');
  else failure = new ApiError(500, 'INTERNAL_ERROR', 'An internal error occurred');
  res.status(failure.status).json({ success: false, error: { code: failure.code, message: failure.message } });
};
