import express from 'express';
import {
  getExpenses,
  getMonthlySummary,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from '../controllers/expenseController.js';
import { protect } from '../middleware/authMiddleware.js';
import { uploadReceipt } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/summary/monthly', getMonthlySummary);
router.get('/', getExpenses);
router.get('/:id', getExpenseById);
router.post('/', uploadReceipt.single('receipt'), createExpense);
router.put('/:id', uploadReceipt.single('receipt'), updateExpense);
router.delete('/:id', deleteExpense);

export default router;
