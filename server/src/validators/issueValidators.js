import { body, param } from 'express-validator';
import { DEPARTMENT_VALUES, STATUS_VALUES } from '../config/constants.js';

// Validates the `:id` route parameter so malformed identifiers are rejected
// before they reach the controller.
export const issueIdRule = [
  param('id').isMongoId().withMessage('A valid issue id is required.'),
];

export const createIssueRules = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 120 })
    .withMessage('Title must be between 5 and 120 characters.'),
  body('description')
    .trim()
    .isLength({ min: 20, max: 4000 })
    .withMessage('Description must be between 20 and 4000 characters.'),
  body('location')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Location must be at most 120 characters.'),
  // Priority, status, and department are all derived server-side; reject any
  // client-supplied values so a reporter can never influence routing.
  body('priority').not().exists().withMessage('Priority is set by the system.'),
  body('status').not().exists().withMessage('Status is set by the system.'),
  body('department').not().exists().withMessage('Department is set by the system.'),
  body('category').not().exists().withMessage('Department is set by the system.'),
];

export const departmentUpdateRules = [
  body('department')
    .isIn(DEPARTMENT_VALUES)
    .withMessage(`Department must be one of: ${DEPARTMENT_VALUES.join(', ')}.`),
  body('note')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note must be at most 1000 characters.'),
];

export const statusUpdateRules = [
  body('status').isIn(STATUS_VALUES).withMessage('Unknown status value.'),
  body('note')
    .optional({ values: 'falsy' })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Note must be at most 1000 characters.'),
];

export const assignRules = [
  body('assignedTo').isMongoId().withMessage('A valid staff user id is required.'),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
];

export const followUpRules = [
  body('note')
    .trim()
    .isLength({ min: 2, max: 1000 })
    .withMessage('Follow-up note must be between 2 and 1000 characters.'),
];

export const duplicateRules = [
  body('duplicateOf').isMongoId().withMessage('A valid issue id is required.'),
  body('note').optional({ values: 'falsy' }).trim().isLength({ max: 1000 }),
];
