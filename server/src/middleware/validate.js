import { validationResult } from 'express-validator';
import ApiError from '../utils/ApiError.js';

// Runs after an array of express-validator chains; short-circuits with 422.
export default function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((e) => ({
    field: e.path || e.param,
    message: e.msg,
  }));
  return next(ApiError.unprocessable('One or more fields are invalid.', details));
}
