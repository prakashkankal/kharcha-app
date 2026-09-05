import React, { createContext, useContext, useState, useEffect } from 'react';
import { categoryApi } from '../services/categoryApi';
import { useAuth } from './AuthContext';
import { localDbGetKV, localDbSetKV } from '../services/localDb';

const CategoryContext = createContext();

const LOCAL_CATEGORIES_KEY = 'kharcha_cached_categories';

// Default categories fallback so user can always immediately categorize even on 1st cold start
const DEFAULT_FALLBACK_CATEGORIES = [
  { _id: 'food_default', name: 'Food & Dining', icon: '🍔', sortOrder: 1 },
  { _id: 'shopping_default', name: 'Shopping', icon: '🛍️', sortOrder: 2 },
  { _id: 'transport_default', name: 'Transportation', icon: '🚗', sortOrder: 3 },
  { _id: 'bills_default', name: 'Bills & Utilities', icon: '💡', sortOrder: 4 },
];

export const CategoryProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState(() => {
    try {
      const cached = localStorage.getItem(LOCAL_CATEGORIES_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached categories:', e);
    }
    return DEFAULT_FALLBACK_CATEGORIES;
  });

  const [loadingCategories, setLoadingCategories] = useState(false);

  const sortByOrder = (cats) =>
    [...cats].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));

  const saveCategoriesLocal = (cats) => {
    const sorted = sortByOrder(cats);
    setCategories(sorted);
    try {
      localStorage.setItem(LOCAL_CATEGORIES_KEY, JSON.stringify(sorted));
      localDbSetKV(LOCAL_CATEGORIES_KEY, sorted);
    } catch (e) {
      console.warn('Failed to cache categories locally:', e);
    }
  };

  const fetchCategories = async () => {
    if (!isAuthenticated) {
      setLoadingCategories(false);
      return;
    }

    setLoadingCategories(true);

    // Load from IndexedDB KV first if state is still default
    try {
      const dbCats = await localDbGetKV(LOCAL_CATEGORIES_KEY);
      if (dbCats && dbCats.length > 0) {
        setCategories(sortByOrder(dbCats));
      }
    } catch (e) {
      // ignore
    }

    try {
      const data = await categoryApi.getCategories();
      if (Array.isArray(data) && data.length > 0) {
        saveCategoriesLocal(data);
      }
    } catch (error) {
      console.warn('Silent category fetch error (Render waking up):', error.message);
      // Retain cached categories!
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [isAuthenticated]);

  const addCategory = async (categoryData) => {
    const newCategory = await categoryApi.createCategory(categoryData);
    const updated = [...categories, newCategory];
    saveCategoriesLocal(updated);
    return newCategory;
  };

  const updateCategory = async (id, categoryData) => {
    const updated = await categoryApi.updateCategory(id, categoryData);
    const newList = categories.map((cat) => (cat._id === id ? updated : cat));
    saveCategoriesLocal(newList);
    return updated;
  };

  const reorderCategories = async (orderedIds) => {
    // Optimistic update
    const idToIndex = new Map(orderedIds.map((id, index) => [id, index + 1]));
    const updated = categories.map((cat) => ({
      ...cat,
      sortOrder: idToIndex.get(cat._id) ?? cat.sortOrder,
    }));
    saveCategoriesLocal(updated);

    try {
      const updatedList = await categoryApi.reorderCategories(orderedIds);
      saveCategoriesLocal(updatedList);
      return updatedList;
    } catch (err) {
      console.error('Failed to save category order:', err);
      fetchCategories();
      throw err;
    }
  };

  const deleteCategory = async (id, targetCategoryId = null) => {
    const res = await categoryApi.deleteCategory(id, targetCategoryId);
    const filtered = categories.filter((cat) => cat._id !== id);
    saveCategoriesLocal(filtered);
    return res;
  };

  return (
    <CategoryContext.Provider
      value={{
        categories,
        loadingCategories,
        refreshCategories: fetchCategories,
        addCategory,
        updateCategory,
        reorderCategories,
        deleteCategory,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategory = () => {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategory must be used within a CategoryProvider');
  }
  return context;
};
