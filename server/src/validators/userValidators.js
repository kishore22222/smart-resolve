import { body } from 'express-validator';
import { ROLES, ROLE_VALUES, DEPARTMENT_VALUES } from '../config/constants.js';
import { EMAIL_RE } from '../models/User.js';

// Admin-only: provision a staff or admin account.
export const createStaffRules = [
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
  body('role').isIn([ROLES.STAFF, ROLES.ADMIN]).withMessage('Role must be staff or admin.'),
  body('department')
    .if(body('role').equals(ROLES.STAFF))
    .isIn(DEPARTMENT_VALUES)
    .withMessage(
      `Department is required for staff and must be one of: ${DEPARTMENT_VALUES.join(', ')}.`
    ),
];

export const updateUserRules = [
  body('role').optional().isIn(ROLE_VALUES).withMessage('Unknown role.'),
  body('department')
    .optional({ nullable: true })
    .custom((value) => value === null || DEPARTMENT_VALUES.includes(value))
    .withMessage('Unknown department.'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean.'),
];
