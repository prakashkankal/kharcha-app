import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategory } from '../context/CategoryContext';
import { expenseApi } from '../services/expenseApi';

export const AddExpense = () => {
  const navigate = useNavigate();
  const { categories, loadingCategories } = useCategory();

  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Set default category once categories load
  React.useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]._id);
    }
  }, [categories, selectedCategory]);

  const handleReceiptChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Receipt file size must be less than 5MB');
      return;
    }

    setReceiptFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptPreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (!selectedCategory) {
      setError('Please select a category');
      return;
    }

    setLoading(true);

    try {
      const categoryObj = categories.find((c) => c._id === selectedCategory);

      // Instantly saves to device IndexedDB & enqueues for server sync
      await expenseApi.createExpense({
        amount: parsedAmount,
        categoryId: selectedCategory,
        categoryObj,
        date,
        description,
        receiptFile,
        receiptPreview,
      });

      setSuccessMsg('Expense saved! (Stored locally & auto-syncs with server)');

      // Reset form immediately
      setAmount('');
      setDescription('');
      setReceiptFile(null);
      setReceiptPreview(null);
      setDate(new Date().toISOString().slice(0, 10));

      setTimeout(() => {
        setSuccessMsg('');
      }, 4000);
    } catch (err) {
      setError(err.message || 'Failed to save expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="w-full max-w-[1024px] mx-auto pb-safe">
      <div class="max-w-[640px] mx-auto bg-surface-container-lowest border border-outline-variant rounded-xl p-4 md:p-6 shadow-xs">
        {/* Feedback alerts */}
        {error && (
          <div class="mb-4 bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2 border border-error/20">
            <span class="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div class="mb-4 bg-secondary-container text-on-secondary-container px-4 py-3 rounded-lg font-body-sm flex items-center justify-between border border-secondary/20">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px]">check_circle</span>
              <span class="font-medium">{successMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              class="text-xs underline font-semibold hover:opacity-80"
            >
              View Dashboard →
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} class="space-y-4 flex flex-col">
          {/* Amount Input (Bento Style Emphasis) */}
          <div class="bg-surface-bright border border-outline-variant rounded-lg p-3 flex flex-col items-center justify-center relative overflow-hidden group hover:border-primary transition-colors duration-300">
            <div class="absolute inset-0 bg-gradient-to-br from-surface-container to-surface-bright opacity-50 pointer-events-none"></div>
            <label class="font-label-caps text-label-caps text-on-surface-variant uppercase mb-1 z-10" htmlFor="amount">
              Amount
            </label>
            <div class="flex items-center justify-center gap-2 z-10 relative w-full">
              <span class="font-numeric-display text-[28px] text-on-surface-variant font-medium">₹</span>
              <input
                id="amount"
                type="number"
                step="any"
                min="0"
                autoFocus
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                class="bg-transparent border-none font-display text-[30px] md:text-[36px] text-on-background focus:ring-0 text-center w-full max-w-[240px] placeholder:text-outline p-0 m-0 font-bold outline-none"
              />
            </div>
          </div>

          {/* Category Selector Grid */}
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase">
                Category
              </label>
              {categories.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllCategories((v) => !v)}
                  class="flex items-center gap-1 text-primary font-body-sm text-[13px] hover:opacity-80 transition-opacity"
                >
                  {showAllCategories ? (
                    <>
                      <span>Show less</span>
                      <span class="material-symbols-outlined text-[16px]">keyboard_arrow_up</span>
                    </>
                  ) : (
                    <>
                      <span>More</span>
                      <span class="material-symbols-outlined text-[16px]">keyboard_arrow_down</span>
                    </>
                  )}
                </button>
              )}
            </div>
            {loadingCategories ? (
              <div class="py-4 text-center text-on-surface-variant">Loading categories...</div>
            ) : (
              <div class="grid grid-cols-4 gap-2 md:gap-3">
                {(showAllCategories ? categories : categories.slice(0, 4)).map((cat) => {
                  const isSelected = selectedCategory === cat._id;
                  return (
                    <button
                      key={cat._id}
                      type="button"
                      onClick={() => setSelectedCategory(cat._id)}
                      class={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                        isSelected
                          ? 'bg-surface-container border-primary text-primary font-bold shadow-xs'
                          : 'bg-surface-bright border-outline-variant text-on-surface-variant hover:bg-surface-container-low'
                      }`}
                    >
                      <span class="text-lg mb-0.5">{cat.icon || '📦'}</span>
                      <span class="font-body-sm text-[13px] truncate w-full text-center">{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description & Date Row */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="description">
                Description
              </label>
              <input
                id="description"
                type="text"
                placeholder="Add description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                class="bg-surface-bright border border-outline-variant rounded-lg p-2.5 font-body-lg text-on-background focus:ring-1 focus:ring-primary focus:border-primary transition-colors outline-none"
              />
            </div>

            <div class="flex flex-col gap-1">
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase" htmlFor="date">
                Date
              </label>
              <div class="relative">
                <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none text-[20px]">
                  calendar_today
                </span>
                <input
                  id="date"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  class="bg-surface-bright border border-outline-variant rounded-lg p-2.5 pl-10 font-body-lg text-on-background w-full focus:ring-1 focus:ring-primary focus:border-primary transition-colors outline-none"
                />
              </div>
            </div>
          </div>

          {/* Receipt Upload */}
          <div class="flex flex-col gap-1">
            <label class="font-label-caps text-label-caps text-on-surface-variant uppercase">Receipt</label>
            {receiptPreview ? (
              <div class="relative border border-outline-variant rounded-lg p-3 bg-surface-bright flex items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <img src={receiptPreview} alt="Receipt preview" class="w-14 h-14 object-cover rounded border" />
                  <div>
                    <p class="font-body-sm font-medium text-on-surface">{receiptFile?.name}</p>
                    <p class="font-body-sm text-[12px] text-on-surface-variant">
                      {(receiptFile?.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeReceipt}
                  class="p-2 text-error hover:bg-error-container/40 rounded-full transition-colors"
                  title="Remove receipt"
                >
                  <span class="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            ) : (
              <label class="border-2 border-dashed border-outline-variant rounded-lg p-3 flex flex-col items-center justify-center bg-surface-bright hover:bg-surface-container-low transition-colors cursor-pointer group">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleReceiptChange}
                  class="hidden"
                />
                <span class="material-symbols-outlined text-[26px] text-primary mb-0.5 group-hover:scale-110 transition-transform">
                  upload_file
                </span>
                <span class="font-body-lg text-primary font-medium">+ Add Receipt</span>
                <span class="font-body-sm text-[12px] text-on-surface-variant mt-0.5">
                  PNG, JPG or WebP (max 5MB)
                </span>
              </label>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            class="w-full bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md py-3 rounded-full shadow-sm hover:shadow-md transition-all active:scale-[0.98] mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div class="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <span class="material-symbols-outlined">add</span>
                Add Expense
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
