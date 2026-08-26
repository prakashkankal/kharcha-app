import express from 'express';
import { getCategories, createCategory, updateCategory, reorderCategories, deleteCategory } from '../controllers/categoryController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getCategories);
router.post('/', createCategory);
router.put('/reorder', reorderCategories);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;
