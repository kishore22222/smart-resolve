import express from 'express';
import { authenticate } from '../middleware/auth.js';
import * as controller from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/summary', authenticate, controller.summary);

export default router;
