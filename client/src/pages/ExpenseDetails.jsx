import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { expenseApi } from '../services/expenseApi';
import { useCategory } from '../context/CategoryContext';

export const ExpenseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { categories } = useCategory();

  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals & Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);

  // Edit form state
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [newReceiptFile, setNewReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchExpense = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await expenseApi.getExpenseById(id);
      setExpense(data);

      // Populate edit fields
      setEditAmount(data.amount);
      setEditCategory(data.categoryId?._id || data.categoryId);
      setEditDescription(data.description || '');
      setEditDate(new Date(data.date).toISOString().slice(0, 10));
    } catch (err) {
      setError(err.message || 'Failed to load expense details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpense();
  }, [id]);

  const handleReceiptChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Receipt file size must be less than 5MB');
      return;
    }

    setNewReceiptFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReceipt = async () => {
    if (!expense?.receiptUrl) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('removeReceipt', 'true');
      const updated = await expenseApi.updateExpense(id, formData);
      setExpense(updated);
      setNewReceiptFile(null);
      setReceiptPreview(null);
    } catch (err) {
      setError(err.message || 'Failed to remove receipt');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('amount', editAmount);
      formData.append('categoryId', editCategory);
      formData.append('description', editDescription);
      formData.append('date', editDate);
      if (newReceiptFile) {
        formData.append('receipt', newReceiptFile);
      }

      const updated = await expenseApi.updateExpense(id, formData);
      setExpense(updated);
      setIsEditing(false);
      setNewReceiptFile(null);
      setReceiptPreview(null);
    } catch (err) {
      setError(err.message || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async () => {
    setSaving(true);
    try {
      await expenseApi.deleteExpense(id);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to delete expense');
      setSaving(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div class="py-16 text-center text-on-surface-variant flex flex-col items-center gap-2">
        <div class="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p>Loading expense details...</p>
      </div>
    );
  }

  if (error && !expense) {
    return (
      <div class="py-12 max-w-md mx-auto text-center space-y-4">
        <p class="text-error font-medium">{error}</p>
        <button
          onClick={() => navigate('/dashboard')}
          class="px-4 py-2 bg-primary text-on-primary rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div class="w-full max-w-[1024px] mx-auto pb-8">
      {/* Back Header */}
      <div class="flex items-center justify-between mb-4">
        <button
          onClick={() => navigate(-1)}
          class="text-on-surface-variant flex items-center gap-1 p-2 rounded hover:bg-surface-container-low transition-colors"
        >
          <span class="material-symbols-outlined">arrow_back</span>
          <span class="font-title-md text-title-md">Back</span>
        </button>
        <h1 class="font-title-md text-title-md text-primary font-bold">Expense Details</h1>
        <div class="w-16"></div>
      </div>

      {error && (
        <div class="mb-4 bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2">
          <span class="material-symbols-outlined text-[20px]">error</span>
          <span>{error}</span>
        </div>
      )}

      {/* Main Content Layout */}
      {isEditing ? (
        /* Edit Mode Form */
        <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs max-w-2xl mx-auto space-y-5">
          <h2 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold border-b pb-3">
            Edit Expense
          </h2>
          <form onSubmit={handleSaveEdit} class="space-y-4">
            <div>
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                Amount (₹)
              </label>
              <input
                type="number"
                step="any"
                required
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                class="w-full h-12 bg-surface-bright border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface focus:border-primary outline-none"
              />
            </div>

            <div>
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                Category
              </label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                class="w-full h-12 bg-surface-bright border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface focus:border-primary outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat._id} value={cat._id}>
                    {cat.icon} {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                Description
              </label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add description"
                class="w-full h-12 bg-surface-bright border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface focus:border-primary outline-none"
              />
            </div>

            <div>
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                Date
              </label>
              <input
                type="date"
                required
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                class="w-full h-12 bg-surface-bright border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface focus:border-primary outline-none"
              />
            </div>

            <div>
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                Receipt Image
              </label>
              {expense.receiptUrl && !receiptPreview && (
                <div class="mb-2 flex items-center gap-3">
                  <img src={expense.receiptUrl} alt="Receipt" class="w-16 h-16 object-cover rounded border" />
                  <button
                    type="button"
                    onClick={handleRemoveReceipt}
                    class="text-error font-body-sm hover:underline"
                  >
                    Remove Current Receipt
                  </button>
                </div>
              )}

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleReceiptChange}
                class="block w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-surface-container file:text-primary hover:file:bg-surface-container-high"
              />
            </div>

            <div class="flex gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                class="flex-1 h-12 border border-outline-variant text-on-surface rounded-lg font-title-md hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                class="flex-1 h-12 bg-primary text-on-primary rounded-lg font-title-md hover:bg-primary-container disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* View Mode Card */
        <div class="flex flex-col md:flex-row gap-6 items-start">
          {/* Main Details Card */}
          <div class="w-full md:w-2/3 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-xs flex flex-col gap-6">
            {/* Header: Icon, Amount, Category */}
            <div class="flex flex-col items-center border-b border-outline-variant pb-6">
              <div class="w-16 h-16 bg-surface-container-low rounded-xl flex items-center justify-center mb-2 text-3xl shadow-xs">
                {expense.categoryId?.icon || '📦'}
              </div>
              <h2 class="font-numeric-display text-[32px] md:text-[36px] text-on-surface font-bold">
                ₹{expense.amount.toLocaleString('en-IN')}
              </h2>
              <p class="font-body-lg text-on-surface-variant font-medium">
                {expense.categoryId?.name || 'Expense'}
              </p>
            </div>

            {/* Field Details */}
            <div class="flex flex-col gap-4">
              <div class="flex justify-between items-center py-2 border-b border-outline-variant/40">
                <span class="font-body-sm text-on-surface-variant uppercase tracking-wider">Date</span>
                <span class="font-body-lg text-on-surface font-medium">
                  {new Date(expense.date).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>

              {/* Description */}
              <div class="flex flex-col gap-1 py-2">
                <div class="flex justify-between items-center">
                  <span class="font-body-sm text-on-surface-variant uppercase tracking-wider">Description</span>
                  {expense.description ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      class="text-primary font-title-md text-[14px] flex items-center gap-1 hover:bg-surface-container-low px-2 py-1 rounded transition-colors"
                    >
                      <span class="material-symbols-outlined text-[18px]">edit</span> Edit
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      class="text-primary font-title-md text-[14px] flex items-center gap-1 hover:bg-surface-container-low px-2 py-1 rounded transition-colors"
                    >
                      <span class="material-symbols-outlined text-[18px]">add</span> Add Description
                    </button>
                  )}
                </div>
                {expense.description ? (
                  <span class="font-body-lg text-on-surface">{expense.description}</span>
                ) : (
                  <span class="font-body-lg text-outline italic">No description added</span>
                )}
              </div>
            </div>

            {/* Actions: Edit */}
            <button
              onClick={() => setIsEditing(true)}
              class="w-full min-h-[44px] border border-primary text-primary hover:bg-surface-container-low font-title-md rounded-lg flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <span class="material-symbols-outlined text-[20px]">edit</span>
              Edit Expense
            </button>
          </div>

          {/* Secondary Column: Receipt & Delete */}
          <div class="w-full md:w-1/3 flex flex-col gap-6">
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col gap-4">
              <h3 class="font-title-md text-title-md text-on-surface font-semibold">Receipt</h3>

              {expense.receiptUrl ? (
                <div>
                  <div
                    onClick={() => setShowImageZoom(true)}
                    class="relative w-full aspect-[3/4] bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant group cursor-pointer mb-3"
                  >
                    <img
                      src={expense.receiptUrl}
                      alt="Receipt"
                      class="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                    />
                    <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span class="material-symbols-outlined text-white text-[32px] bg-black/40 rounded-full p-2">
                        zoom_in
                      </span>
                    </div>
                  </div>

                  <div class="flex gap-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      class="flex-1 min-h-[40px] bg-surface border border-outline-variant text-on-surface rounded-lg font-title-md text-[13px] flex items-center justify-center gap-1 hover:bg-surface-container-low transition-colors"
                    >
                      <span class="material-symbols-outlined text-[16px]">swap_horiz</span> Replace
                    </button>
                    <button
                      onClick={handleRemoveReceipt}
                      class="flex-1 min-h-[40px] bg-surface border border-error text-error rounded-lg font-title-md text-[13px] flex items-center justify-center gap-1 hover:bg-error-container/40 transition-colors"
                    >
                      <span class="material-symbols-outlined text-[16px]">delete</span> Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div class="py-6 text-center flex flex-col items-center gap-3">
                  <p class="font-body-sm text-on-surface-variant">No receipt added</p>
                  <button
                    onClick={() => setIsEditing(true)}
                    class="px-4 py-2 bg-surface-container text-primary font-title-md text-sm rounded-lg hover:bg-surface-container-high flex items-center gap-1"
                  >
                    <span class="material-symbols-outlined text-[18px]">add</span> Add Receipt
                  </button>
                </div>
              )}
            </div>

            {/* Delete Expense */}
            <button
              onClick={() => setShowDeleteModal(true)}
              class="w-full min-h-[48px] bg-surface-container-lowest border border-error text-error rounded-xl font-title-md flex items-center justify-center gap-2 hover:bg-error-container/40 transition-colors active:scale-98"
            >
              <span class="material-symbols-outlined">delete</span>
              Delete Expense
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4">
          <div class="bg-surface-container-lowest rounded-xl p-6 w-full max-w-[400px] shadow-lg border border-outline-variant flex flex-col gap-4">
            <h3 class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">
              Delete this expense?
            </h3>
            <p class="font-body-lg text-on-surface-variant">
              This action cannot be undone. Are you sure you want to permanently delete this expense?
            </p>
            <div class="flex justify-end gap-3 mt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                class="px-4 h-10 text-primary font-title-md rounded-lg hover:bg-surface-container-low"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteExpense}
                disabled={saving}
                class="px-5 h-10 bg-error text-on-error font-title-md rounded-lg hover:bg-error/90 shadow-xs disabled:opacity-50"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Preview Zoom Modal */}
      {showImageZoom && (
        <div
          onClick={() => setShowImageZoom(false)}
          class="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <div class="relative max-w-3xl max-h-[90vh]">
            <img src={expense?.receiptUrl} alt="Receipt Fullscreen" class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <button
              onClick={() => setShowImageZoom(false)}
              class="absolute top-2 right-2 bg-black/60 text-white rounded-full p-2 hover:bg-black"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
