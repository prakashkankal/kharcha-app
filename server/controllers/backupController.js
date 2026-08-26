import Expense from '../models/Expense.js';
import Category from '../models/Category.js';

export const exportData = async (req, res, next) => {
  try {
    const categories = await Category.find({ userId: req.user._id });
    const expenses = await Expense.find({ userId: req.user._id }).populate('categoryId', 'name icon');

    const backupPayload = {
      app: 'Kharcha',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      user: {
        name: req.user.name,
        email: req.user.email,
      },
      categories: categories.map((c) => ({
        id: c._id,
        name: c.name,
        icon: c.icon,
      })),
      expenses: expenses.map((e) => ({
        id: e._id,
        amount: e.amount,
        category: e.categoryId ? e.categoryId.name : 'Other',
        description: e.description,
        date: e.date,
        receiptUrl: e.receiptUrl,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=kharcha-backup-${Date.now()}.json`);
    res.json(backupPayload);
  } catch (error) {
    next(error);
  }
};

export const importData = async (req, res, next) => {
  try {
    const { expenses, categories } = req.body;

    if (!Array.isArray(expenses)) {
      return res.status(400).json({ message: 'Invalid backup format: expenses array required' });
    }

    // Map categories or seed missing ones
    const categoryMap = new Map();
    const existingCats = await Category.find({ userId: req.user._id });
    existingCats.forEach((c) => categoryMap.set(c.name.toLowerCase(), c._id));

    if (Array.isArray(categories)) {
      for (const cat of categories) {
        if (cat.name && !categoryMap.has(cat.name.toLowerCase())) {
          const newCat = await Category.create({
            userId: req.user._id,
            name: cat.name,
            icon: cat.icon || '📦',
          });
          categoryMap.set(newCat.name.toLowerCase(), newCat._id);
        }
      }
    }

    let defaultCatId = categoryMap.get('other');
    if (!defaultCatId) {
      const fallbackCat = await Category.create({
        userId: req.user._id,
        name: 'Other',
        icon: '📦',
      });
      defaultCatId = fallbackCat._id;
    }

    let importedCount = 0;
    for (const exp of expenses) {
      if (exp.amount && exp.date) {
        const catName = exp.category ? exp.category.toLowerCase() : 'other';
        const categoryId = categoryMap.get(catName) || defaultCatId;

        await Expense.create({
          userId: req.user._id,
          categoryId,
          amount: parseFloat(exp.amount),
          description: exp.description || '',
          receiptUrl: exp.receiptUrl || null,
          date: new Date(exp.date),
        });
        importedCount++;
      }
    }

    res.json({ message: `Successfully imported ${importedCount} expenses.` });
  } catch (error) {
    next(error);
  }
};

export const clearAllData = async (req, res, next) => {
  try {
    const { confirm } = req.body;
    if (!confirm) {
      return res.status(400).json({ message: 'Confirmation is required to delete all user data' });
    }

    await Expense.deleteMany({ userId: req.user._id });
    res.json({ message: 'All expense data has been deleted permanently.' });
  } catch (error) {
    next(error);
  }
};
