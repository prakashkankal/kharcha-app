import express from 'express';
import {
  getPublicKey,
  removeSubscription,
  saveSubscription,
} from '../controllers/notificationController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.get('/public-key', getPublicKey);
router.post('/subscriptions', saveSubscription);
router.delete('/subscriptions', removeSubscription);

export default router;
