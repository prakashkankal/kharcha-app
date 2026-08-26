import express from 'express';
import { getProfile, updateProfile } from '../controllers/profileController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadReceipt } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getProfile);
router.put('/', uploadReceipt.single('avatar'), updateProfile);

export default router;
