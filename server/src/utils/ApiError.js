export default class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message, details, code = 'BAD_REQUEST') {
    return new ApiError(400, code, message, details);
  }

  static unauthorized(message = 'Authentication required.', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message);
  }

  static forbidden(
    message = 'You do not have permission to perform this action.',
    code = 'FORBIDDEN'
  ) {
    return new ApiError(403, code, message);
  }

  static notFound(message = 'Resource not found.', code = 'NOT_FOUND') {
    return new ApiError(404, code, message);
  }

  static conflict(message, details, code = 'CONFLICT') {
    return new ApiError(409, code, message, details);
  }

  static unprocessable(message, details, code = 'VALIDATION_ERROR') {
    return new ApiError(422, code, message, details);
  }

  static serviceUnavailable(
    message = 'Dependent service unavailable.',
    code = 'SERVICE_UNAVAILABLE'
  ) {
    return new ApiError(503, code, message);
  }
}
