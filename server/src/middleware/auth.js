import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import User from '../models/User.js';

export function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, department: user.department || null },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
}

export async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw ApiError.unauthorized('Missing or malformed Authorization header.');
    }

    let payload;
    try {
      payload = jwt.verify(token, env.jwtSecret);
    } catch (err) {
      throw ApiError.unauthorized('Invalid or expired session.');
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Account is not available.');
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

// Role gate. Usage: authorize(ROLES.ADMIN) or authorize(ROLES.STAFF, ROLES.ADMIN)
export function authorize(...roles) {
  return function roleGate(req, res, next) {
    if (!req.user) return next(ApiError.unauthorized());
    if (roles.length && !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('Your role does not permit this action.'));
    }
    return next();
  };
}
