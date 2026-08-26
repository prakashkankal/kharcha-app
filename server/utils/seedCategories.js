import Category from '../models/Category.js';

export const DEFAULT_CATEGORIES = [
  { name: 'Food', icon: '🍔', sortOrder: 1 },
  { name: 'Travel', icon: '🚌', sortOrder: 2 },
  { name: 'Shopping', icon: '🛍', sortOrder: 3 },
  { name: 'Education', icon: '📚', sortOrder: 4 },
  { name: 'Bills', icon: '💡', sortOrder: 5 },
  { name: 'Entertainment', icon: '🎮', sortOrder: 6 },
  { name: 'Health', icon: '❤️', sortOrder: 7 },
  { name: 'Other', icon: '📦', sortOrder: 8 },
];

export const seedDefaultCategories = async (userId) => {
  try {
    const existing = await Category.find({ userId });
    if (existing.length === 0) {
      const categoriesToCreate = DEFAULT_CATEGORIES.map((cat) => ({
        userId,
        ...cat,
      }));
      await Category.insertMany(categoriesToCreate);
    }
  } catch (error) {
    console.error('Error seeding default categories:', error.message);
  }
};
