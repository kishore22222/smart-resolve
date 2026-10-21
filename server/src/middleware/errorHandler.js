import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`No route matches ${req.method} ${req.originalUrl}.`));
}

export function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Something went wrong.';
  let details = err.details;

  // Map common Mongoose errors to safe, consistent responses.
  if (err.name === 'ValidationError' && !err.statusCode) {
    status = 422;
    code = 'VALIDATION_ERROR';
    message = 'One or more fields are invalid.';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  } else if (err.name === 'CastError') {
    status = 400;
    code = 'BAD_REQUEST';
    message = 'Malformed identifier.';
  } else if (err.code === 11000) {
    status = 409;
    code = 'CONFLICT';
    const field = Object.keys(err.keyPattern || { value: 1 })[0];
    message = `A record with that ${field} already exists.`;
  }

  if (status >= 500) {
    // Log the real cause server-side, never leak it to the client.
    // eslint-disable-next-line no-console
    console.error('[error]', err);
    message = env.isProduction ? 'Something went wrong.' : err.message;
  }

  const body = { error: { code, message } };
  if (details) body.error.details = details;
  if (!env.isProduction && err.stack) body.error.stack = err.stack;

  res.status(status).json(body);
}
