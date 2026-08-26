import React, { createContext, useContext, useState, useEffect } from 'react';
import { categoryApi } from '../services/categoryApi';
import { useAuth } from './AuthContext';

const CategoryContext = createContext();

export const CategoryProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  const sortByOrder = (cats) =>
    [...cats].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name));

  const fetchCategories = async () => {
    if (!isAuthenticated) {
      setCategories([]);
      return;
    }
    setLoadingCategories(true);
    try {
      const data = await categoryApi.getCategories();
      setCategories(sortByOrder(data));
    } catch (error) {
      console.error('Failed to load categories:', error.message);
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [isAuthenticated]);

  const addCategory = async (categoryData) => {
    const newCategory = await categoryApi.createCategory(categoryData);
    setCategories((prev) => sortByOrder([...prev, newCategory]));
    return newCategory;
  };

  const updateCategory = async (id, categoryData) => {
    const updated = await categoryApi.updateCategory(id, categoryData);
    setCategories((prev) => sortByOrder(prev.map((cat) => (cat._id === id ? updated : cat))));
    return updated;
  };

  const reorderCategories = async (orderedIds) => {
    // Optimistic update using map to assign new sortOrders
    setCategories((prev) => {
      const idToIndex = new Map(orderedIds.map((id, index) => [id, index + 1]));
      const updated = prev.map((cat) => ({
        ...cat,
        sortOrder: idToIndex.get(cat._id) ?? cat.sortOrder,
      }));
      return sortByOrder(updated);
    });

    try {
      const updatedList = await categoryApi.reorderCategories(orderedIds);
      setCategories(sortByOrder(updatedList));
      return updatedList;
    } catch (err) {
      console.error('Failed to save category order:', err);
      fetchCategories(); // revert on error
      throw err;
    }
  };

  const deleteCategory = async (id, targetCategoryId = null) => {
    const res = await categoryApi.deleteCategory(id, targetCategoryId);
    setCategories((prev) => prev.filter((cat) => cat._id !== id));
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
