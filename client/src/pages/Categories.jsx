import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategory } from '../context/CategoryContext';

const EMOJI_OPTIONS = ['🍔', '🚌', '🛍', '📚', '💡', '🎮', '❤️', '🏋️', '☕', '🚗', '🎬', '✈️', '💊', '🏠', '🎁', '📦'];

export const Categories = () => {
  const navigate = useNavigate();
  const { categories, addCategory, updateCategory, reorderCategories, deleteCategory } = useCategory();

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [deletingCat, setDeletingCat] = useState(null);

  // Form states
  const [catName, setCatName] = useState('');
  const [catIcon, setCatIcon] = useState('📦');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMoveUp = async (index) => {
    if (index <= 0) return;
    setError('');
    const newOrder = [...categories];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index - 1];
    newOrder[index - 1] = temp;
    const orderedIds = newOrder.map((c) => c._id);
    try {
      await reorderCategories(orderedIds);
    } catch (err) {
      setError(err.message || 'Failed to update category order');
    }
  };

  const handleMoveDown = async (index) => {
    if (index >= categories.length - 1) return;
    setError('');
    const newOrder = [...categories];
    const temp = newOrder[index];
    newOrder[index] = newOrder[index + 1];
    newOrder[index + 1] = temp;
    const orderedIds = newOrder.map((c) => c._id);
    try {
      await reorderCategories(orderedIds);
    } catch (err) {
      setError(err.message || 'Failed to update category order');
    }
  };

  const handleOpenAdd = () => {
    setCatName('');
    setCatIcon('🏋️');
    setError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatIcon(cat.icon || '📦');
    setError('');
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!catName.trim()) {
      setError('Category name is required');
      return;
    }
    setError('');
    setLoading(true);

    try {
      if (editingCat) {
        await updateCategory(editingCat._id, { name: catName, icon: catIcon });
        setEditingCat(null);
      } else {
        await addCategory({ name: catName, icon: catIcon });
        setShowAddModal(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to save category');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCat) return;
    setLoading(true);
    try {
      await deleteCategory(deletingCat._id);
      setDeletingCat(null);
    } catch (err) {
      setError(err.message || 'Failed to delete category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="w-full max-w-[1024px] mx-auto pb-12">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate('/profile')}
          class="text-primary flex items-center gap-1 p-2 rounded hover:bg-surface-container-low transition-colors"
        >
          <span class="material-symbols-outlined">arrow_back</span>
          <span class="font-title-md">Back to Profile</span>
        </button>
        <h1 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">Categories</h1>
        <div class="w-20"></div>
      </div>

      <p class="font-body-lg text-on-surface-variant mb-6">
        Manage your expense categories and their order. Top categories appear first on the Add Expense screen.
      </p>

      {error && (
        <div class="mb-4 bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Categories List */}
      <div class="flex flex-col gap-3 mb-8">
        {categories.map((cat, index) => (
          <div
            key={cat._id}
            class="flex items-center justify-between p-3 md:p-4 bg-surface-container-lowest border border-outline-variant rounded-xl min-h-[56px] hover:shadow-xs transition-shadow"
          >
            <div class="flex items-center gap-3">
              {/* Order Controls (Up/Down) */}
              <div class="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  title="Move Up"
                  class="p-1 text-on-surface-variant hover:text-primary disabled:opacity-20 disabled:hover:text-on-surface-variant transition-colors"
                >
                  <span class="material-symbols-outlined text-[18px]">keyboard_arrow_up</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === categories.length - 1}
                  title="Move Down"
                  class="p-1 text-on-surface-variant hover:text-primary disabled:opacity-20 disabled:hover:text-on-surface-variant transition-colors"
                >
                  <span class="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
                </button>
              </div>

              <div class="w-10 h-10 rounded-lg bg-surface-container-low flex items-center justify-center text-xl shrink-0">
                {cat.icon || '📦'}
              </div>
              <div class="flex flex-col">
                <span class="font-title-md text-title-md text-on-surface font-medium">{cat.name}</span>
                <span class="text-[11px] text-on-surface-variant">Position #{index + 1}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                onClick={() => handleOpenEdit(cat)}
                class="text-primary font-label-caps text-label-caps px-3 py-1.5 rounded-lg hover:bg-surface-container-low border border-transparent hover:border-outline-variant transition-all"
              >
                EDIT
              </button>
              {categories.length > 1 && (
                <button
                  onClick={() => setDeletingCat(cat)}
                  class="text-error font-label-caps text-label-caps px-3 py-1.5 rounded-lg hover:bg-error-container/40 border border-transparent transition-all"
                >
                  DELETE
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Category Button */}
      <button
        onClick={handleOpenAdd}
        class="w-full h-12 bg-primary text-on-primary rounded-full font-title-md flex items-center justify-center gap-2 hover:bg-primary-container active:scale-98 transition-all shadow-xs"
      >
        <span class="material-symbols-outlined text-[20px]">add</span>
        Add Category
      </button>

      {/* Add / Edit Category Modal */}
      {(showAddModal || editingCat) && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div class="bg-surface-container-lowest rounded-xl p-6 w-full max-w-[420px] shadow-lg border border-outline-variant flex flex-col gap-4">
            <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              {editingCat ? 'Edit Category' : 'Add Category'}
            </h3>

            <form onSubmit={handleSaveCategory} class="space-y-4">
              <div>
                <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gym, Rent"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  class="w-full h-12 bg-surface-bright border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface focus:border-primary outline-none"
                />
              </div>

              <div>
                <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                  Select Icon
                </label>
                <div class="grid grid-cols-8 gap-2 p-2 bg-surface-bright border border-outline-variant rounded-lg">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setCatIcon(emoji)}
                      class={`w-8 h-8 flex items-center justify-center text-lg rounded ${
                        catIcon === emoji ? 'bg-primary text-white' : 'hover:bg-surface-container'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingCat(null);
                  }}
                  class="px-4 h-10 text-on-surface-variant font-title-md rounded-lg hover:bg-surface-container-low"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  class="px-5 h-10 bg-primary text-on-primary font-title-md rounded-lg hover:bg-primary-container disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingCat ? 'Save Changes' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Category Confirmation */}
      {deletingCat && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div class="bg-surface-container-lowest rounded-xl p-6 w-full max-w-[400px] shadow-lg border border-outline-variant flex flex-col gap-4">
            <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              Delete category "{deletingCat.name}"?
            </h3>
            <p class="font-body-lg text-on-surface-variant">
              Any existing expenses in this category will automatically be moved to the <strong>Other</strong> category. No expense data will be lost.
            </p>
            <div class="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setDeletingCat(null)}
                class="px-4 h-10 text-on-surface-variant font-title-md rounded-lg hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={loading}
                class="px-5 h-10 bg-error text-on-error font-title-md rounded-lg hover:bg-error/90 disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
