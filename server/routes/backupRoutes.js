import express from 'express';
import { exportData, importData, clearAllData } from '../controllers/backupController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/export', exportData);
router.post('/import', importData);
router.post('/clear-all', clearAllData);

export default router;
