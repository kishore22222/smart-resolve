import User from '../models/User.js';
import { ROLES } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { signToken } from '../middleware/auth.js';

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    throw ApiError.conflict('An account with that email already exists.');
  }

  const user = new User({
    name,
    email,
    // Public registration can ONLY create a reporter. Role is never read from input.
    role: ROLES.REPORTER,
    department: null,
  });
  await user.setPassword(password);
  await user.save();

  const token = signToken(user);
  res.status(201).json({ data: { token, user } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase();

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  // Generic message prevents account enumeration.
  if (!user) {
    // Safe diagnostic: records the attempted email only, never the password or hash.
    // eslint-disable-next-line no-console
    console.warn(`[auth] login rejected: no account for ${normalizedEmail}`);
    throw ApiError.unauthorized('Invalid email or password.');
  }

  const ok = await user.verifyPassword(password);
  if (!ok) {
    // eslint-disable-next-line no-console
    console.warn(`[auth] login rejected: bad credentials for ${normalizedEmail}`);
    throw ApiError.unauthorized('Invalid email or password.');
  }

  if (!user.isActive) throw ApiError.forbidden('This account has been disabled.');

  const token = signToken(user);
  res.json({ data: { token, user } });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ data: { user: req.user } });
});
