import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCategory } from '../context/CategoryContext';
import { profileApi } from '../services/profileApi';

export const Onboarding = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const { categories, loadingCategories, reorderCategories } = useCategory();
  const [monthlyBudget, setMonthlyBudget] = useState(user?.settings?.monthlyBudget || '');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (selectedCategoryIds.length === 0 && categories.length > 0) {
      setSelectedCategoryIds(categories.slice(0, 3).map((category) => category._id));
    }
  }, [categories, selectedCategoryIds.length]);

  const toggleCategory = (categoryId) => {
    setSelectedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (selectedCategoryIds.length === 0) {
      setError('Choose at least one category to continue');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const updated = await profileApi.updateProfile({
        monthlyBudget: Number(monthlyBudget) || 0,
        onboardingCompleted: true,
      });
      updateUser(updated);

      const selectedSet = new Set(selectedCategoryIds);
      const orderedIds = [
        ...selectedCategoryIds,
        ...categories.filter((category) => !selectedSet.has(category._id)).map((category) => category._id),
      ];
      const hasServerCategories = orderedIds.every((id) => /^[a-f\d]{24}$/i.test(id));
      if (hasServerCategories) {
        await reorderCategories(orderedIds);
      }

      navigate('/add-expense', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not finish account setup');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="min-h-screen w-full flex items-center justify-center p-4 md:p-8 bg-background">
      <main class="w-full max-w-[560px] bg-surface-container-lowest border border-outline-variant rounded-xl p-6 md:p-8 shadow-sm">
        <header class="text-center mb-8">
          <div class="flex justify-center items-center gap-2 mb-3">
            <img src="/logo.png" alt="Kharcha Logo" class="w-10 h-10 rounded-xl object-cover shadow-sm" />
            <h1 class="font-display text-[28px] text-primary font-bold tracking-tight">Kharcha</h1>
          </div>
          <p class="font-headline-lg-mobile text-[24px] text-on-surface font-bold">Set up your spending plan</p>
          <p class="font-body-lg text-on-surface-variant mt-2">Add a monthly budget and choose the categories you use most.</p>
        </header>

        {error && (
          <div class="mb-5 bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2 border border-error/20">
            <span class="material-symbols-outlined text-[20px]">error</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} class="flex flex-col gap-6">
          <div>
            <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1" htmlFor="onboarding-budget">
              Monthly budget (optional)
            </label>
            <input
              id="onboarding-budget"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 30000"
              value={monthlyBudget}
              onChange={(event) => setMonthlyBudget(event.target.value)}
              class="w-full h-12 bg-surface-bright border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <div class="flex items-center justify-between gap-3 mb-2">
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase">Choose categories</label>
              <span class="font-body-sm text-on-surface-variant">{selectedCategoryIds.length} selected</span>
            </div>
            {loadingCategories ? (
              <p class="font-body-sm text-on-surface-variant py-4">Loading categories...</p>
            ) : (
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((category) => {
                  const selected = selectedCategoryIds.includes(category._id);
                  return (
                    <button
                      key={category._id}
                      type="button"
                      onClick={() => toggleCategory(category._id)}
                      class={`min-h-[72px] rounded-lg border px-3 py-2 flex flex-col items-center justify-center gap-1 transition-colors ${
                        selected
                          ? 'bg-primary text-on-primary border-primary'
                          : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high border-outline-variant'
                      }`}
                    >
                      <span class="text-xl">{category.icon || '📦'}</span>
                      <span class="font-body-sm text-center leading-tight">{category.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || loadingCategories || categories.length === 0}
            class="h-12 w-full bg-primary text-on-primary font-title-md rounded-lg hover:bg-primary-container transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Finish Setup'}
          </button>
        </form>
      </main>
    </div>
  );
};