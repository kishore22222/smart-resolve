import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';
import * as controller from '../controllers/reportController.js';

const router = express.Router();

router.get('/summary', authenticate, authorize(ROLES.ADMIN), controller.summary);

export default router;
