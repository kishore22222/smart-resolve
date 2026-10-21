import express from 'express';
import validate from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import { createStaffRules, updateUserRules } from '../validators/userValidators.js';
import * as controller from '../controllers/userController.js';

const router = express.Router();

router.use(authenticate);

router.get('/', authorize(ROLES.STAFF, ROLES.ADMIN), controller.listUsers);
router.post('/staff', authorize(ROLES.ADMIN), createStaffRules, validate, controller.createStaff);
router.patch('/:id', authorize(ROLES.ADMIN), updateUserRules, validate, controller.updateUser);

export default router;
