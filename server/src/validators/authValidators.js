import { body } from 'express-validator';
import { EMAIL_RE } from '../models/User.js';

export const registerRules = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage('Name must be between 2 and 80 characters.'),
  body('email')
    .trim()
    .toLowerCase()
    .matches(EMAIL_RE)
    .withMessage('Please provide a valid email address.'),
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters.'),
  // A public client may not choose a role; reject the field outright if present.
  body('role').not().exists().withMessage('Role may not be supplied at registration.'),
];

export const loginRules = [
  body('email')
    .trim()
    .toLowerCase()
    .matches(EMAIL_RE)
    .withMessage('Please provide a valid email address.'),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];
