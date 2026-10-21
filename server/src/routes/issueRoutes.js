import express from 'express';
import validate from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import {
  createIssueRules,
  statusUpdateRules,
  assignRules,
  followUpRules,
  duplicateRules,
  departmentUpdateRules,
  issueIdRule,
} from '../validators/issueValidators.js';
import * as controller from '../controllers/issueController.js';

export default function createIssueRoutes({ issueCreateLimiter }) {
  const router = express.Router();

  // req.user comes from the verified JWT in every handler below; no
  // client-supplied identity field is ever consulted.
  router.use(authenticate);

  router.get('/filters', controller.filters);
  router.get('/', controller.listIssues);
  // Creation limiter runs after authentication (it keys on the trusted user
  // id) and before validation/classification, so spam submissions stop at
  // the middleware rather than after bcrypt/ML work.
  router.post(
    '/',
    authorize(ROLES.REPORTER, ROLES.ADMIN),
    issueCreateLimiter,
    createIssueRules,
    validate,
    controller.createIssue
  );

  router.get('/:id', controller.getIssue);
  router.get('/:id/history', controller.getHistory);
  router.get('/:id/duplicates', controller.getDuplicates);

  router.post('/:id/follow-up', followUpRules, validate, controller.addFollowUp);
  router.post('/:id/status', statusUpdateRules, validate, controller.updateStatus);
  router.post(
    '/:id/assign',
    authorize(ROLES.STAFF, ROLES.ADMIN),
    assignRules,
    validate,
    controller.assignIssue
  );
  router.post(
    '/:id/duplicate',
    authorize(ROLES.STAFF, ROLES.ADMIN),
    duplicateRules,
    validate,
    controller.markDuplicate
  );
  router.patch(
    '/:id/department',
    authorize(ROLES.ADMIN),
    departmentUpdateRules,
    validate,
    controller.updateDepartment
  );

  // Soft-delete is a reporter-only action: staff and admin receive 403.
  router.delete('/:id', authorize(ROLES.REPORTER), issueIdRule, validate, controller.deleteIssue);

  return router;
}
