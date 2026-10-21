import User from '../models/User.js';
import { ROLES } from '../config/constants.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

// Admin sees everyone; staff may list active staff in their own department to
// populate the assignment control. Reporters get nothing.
export const listUsers = asyncHandler(async (req, res) => {
  const { role, department, q, isActive } = req.query;
  const filter = {};

  if (req.user.role === ROLES.STAFF) {
    filter.role = { $in: [ROLES.STAFF, ROLES.ADMIN] };
    filter.department = req.user.department;
    filter.isActive = true;
  } else {
    if (role) filter.role = role;
    if (department) filter.department = department;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
  }

  if (q) {
    const safe = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [{ name: new RegExp(safe, 'i') }, { email: new RegExp(safe, 'i') }];
  }

  const users = await User.find(filter).sort({ role: 1, name: 1 }).limit(200);
  res.json({ data: { items: users } });
});

export const createStaff = asyncHandler(async (req, res) => {
  const { name, email, password, role, department } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) throw ApiError.conflict('An account with that email already exists.');

  const user = new User({
    name,
    email,
    role,
    department: role === ROLES.STAFF ? department : null,
  });
  await user.setPassword(password);
  await user.save();

  res.status(201).json({ data: { user } });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { role, department, isActive } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  if (req.params.id === req.user._id.toString() && (role || isActive === false)) {
    throw ApiError.badRequest('You cannot change your own role or deactivate your own account.');
  }

  if (role !== undefined) user.role = role;
  if (department !== undefined) user.department = department;
  if (isActive !== undefined) user.isActive = isActive;

  if (user.role === ROLES.STAFF && !user.department) {
    throw ApiError.badRequest('Staff accounts must have a department.');
  }
  if (user.role !== ROLES.STAFF) user.department = null;

  await user.save();
  res.json({ data: { user } });
});
