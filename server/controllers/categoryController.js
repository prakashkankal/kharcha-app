import Category from '../models/Category.js';
import Expense from '../models/Expense.js';

export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ userId: req.user._id }).sort({ sortOrder: 1, createdAt: 1 });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name, icon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const existing = await Category.findOne({ userId: req.user._id, name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: 'Category with this name already exists' });
    }

    const maxSort = await Category.findOne({ userId: req.user._id }).sort({ sortOrder: -1 });
    const sortOrder = maxSort ? maxSort.sortOrder + 1 : 1;

    const category = await Category.create({
      userId: req.user._id,
      name: name.trim(),
      icon: icon || '📦',
      sortOrder,
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, icon, sortOrder } = req.body;

    const category = await Category.findOne({ _id: id, userId: req.user._id });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    if (name && name.trim() !== category.name) {
      const existing = await Category.findOne({ userId: req.user._id, name: name.trim() });
      if (existing) {
        return res.status(400).json({ message: 'Another category with this name already exists' });
      }
      category.name = name.trim();
    }

    if (icon !== undefined) category.icon = icon;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;

    await category.save();
    res.json(category);
  } catch (error) {
    next(error);
  }
};

export const reorderCategories = async (req, res, next) => {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ message: 'orderedIds array is required' });
    }

    const updatePromises = orderedIds.map((id, index) =>
      Category.updateOne({ _id: id, userId: req.user._id }, { $set: { sortOrder: index + 1 } })
    );

    await Promise.all(updatePromises);

    const categories = await Category.find({ userId: req.user._id }).sort({ sortOrder: 1, createdAt: 1 });
    res.json(categories);
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { targetCategoryId } = req.body;

    const category = await Category.findOne({ _id: id, userId: req.user._id });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if expenses use this category
    const count = await Expense.countDocuments({ userId: req.user._id, categoryId: id });

    if (count > 0) {
      let fallbackCategory;
      if (targetCategoryId) {
        fallbackCategory = await Category.findOne({ _id: targetCategoryId, userId: req.user._id });
      }

      if (!fallbackCategory) {
        fallbackCategory = await Category.findOne({ userId: req.user._id, name: 'Other' });
      }

      if (!fallbackCategory) {
        fallbackCategory = await Category.create({
          userId: req.user._id,
          name: 'Other',
          icon: '📦',
          sortOrder: 99,
        });
      }

      // Reassign expenses to fallback category
      await Expense.updateMany(
        { userId: req.user._id, categoryId: id },
        { $set: { categoryId: fallbackCategory._id } }
      );
    }

    await category.deleteOne();
    res.json({ message: 'Category deleted successfully', expensesMigratedCount: count });
  } catch (error) {
    next(error);
  }
};
