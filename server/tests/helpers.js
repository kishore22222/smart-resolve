import request from 'supertest';
import createApp from '../src/app.js';
import User from '../src/models/User.js';
import { ROLES } from '../src/config/constants.js';
import { signToken } from '../src/middleware/auth.js';

const app = createApp();

async function makeUser({
  name = 'Test User',
  email,
  password = 'Password123!',
  role = ROLES.REPORTER,
  department = null,
}) {
  const user = new User({ name, email, role, department: role === ROLES.STAFF ? department : null });
  await user.setPassword(password);
  await user.save();
  const token = signToken(user);
  return { user, token };
}

function auth(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

export { app, request, makeUser, auth, User, ROLES };
