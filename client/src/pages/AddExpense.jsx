import { CategoryIcon, Icon } from '../components/Icon.jsx';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCategory } from '../context/CategoryContext';
import { useAuth } from '../context/AuthContext';
import { expenseApi } from '../services/expenseApi';
import { validateSplitParticipantsClient } from '../services/transactionUtils';

// Interactive Right-Slide to Save Button
const SlideToSaveButton = ({ onConfirm, loading, disabled }) => {
  const [slideX, setSlideX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const trackRef = useRef(null);
  const startXRef = useRef(0);

  // When loading finishes, reset slider
  useEffect(() => {
    if (!loading) {
      setHasConfirmed(false);
      setSlideX(0);
    }
  }, [loading]);

  const getMaxSlide = () => {
    if (!trackRef.current) return 220;
    return Math.max(80, trackRef.current.clientWidth - 50 - 12);
  };

  const handleStart = (clientX) => {
    if (disabled || loading || hasConfirmed) return;
    setIsDragging(true);
    startXRef.current = clientX - slideX;
  };

  const handleMove = (clientX) => {
    if (!isDragging || loading || hasConfirmed) return;
    const max = getMaxSlide();
    const newX = Math.max(0, Math.min(max, clientX - startXRef.current));
    setSlideX(newX);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    const max = getMaxSlide();

    // Trigger confirmation when dragged past 75%
    if (slideX >= max * 0.75) {
      setSlideX(max);
      setHasConfirmed(true);
      onConfirm();
    } else {
      // Snap back smoothly
      setSlideX(0);
    }
  };

  // Touch handlers for mobile
  const onTouchStart = (e) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e) => handleMove(e.touches[0].clientX);
  const onTouchEnd = handleEnd;

  // Mouse handlers for desktop
  const onMouseDown = (e) => {
    handleStart(e.clientX);
    const onMouseMove = (moveEvent) => handleMove(moveEvent.clientX);
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      handleEnd();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const maxSlide = getMaxSlide();
  const progressRatio = maxSlide > 0 ? slideX / maxSlide : 0;

  return (
    <div
      ref={trackRef}
      class={`relative w-full h-[60px] p-1.5 rounded-full select-none overflow-hidden transition-all shadow-lg shadow-indigo-950/25 ${
        disabled
          ? 'bg-slate-300 opacity-60 cursor-not-allowed'
          : 'bg-[#1E1B8F]'
      }`}
    >
      {/* Progress fill following the knob */}
      <div
        class="absolute left-0 top-0 bottom-0 bg-white/20 rounded-full transition-all pointer-events-none"
        style={{ width: `${slideX + 54}px` }}
      />

      {/* Centered prompt text */}
      <div
        class="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity"
        style={{ opacity: Math.max(0, 1 - progressRatio * 1.5) }}
      >
        <span class="text-sm font-bold text-white/90 tracking-wide flex items-center gap-1.5 pl-8">
          <span>{loading ? 'Saving Expense...' : 'Slide right to save'}</span>
          {!loading && <Icon name="arrow_forward" className="text-[16px] text-white/70 animate-pulse" />}
        </span>
      </div>

      {/* Draggable slider thumb */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        style={{
          transform: `translateX(${slideX}px)`,
          transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        class={`relative z-10 w-[48px] h-[48px] rounded-full bg-white flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-grab active:cursor-grabbing ${
          disabled ? 'cursor-not-allowed' : ''
        }`}
      >
        {loading ? (
          <div class="w-5 h-5 border-2 border-[#1E1B8F] border-t-transparent rounded-full animate-spin" />
        ) : hasConfirmed ? (
          <Icon name="check" className="text-[22px] text-emerald-600 font-bold" />
        ) : (
          <Icon name="arrow_forward" className="text-[20px] text-[#1E1B8F] font-bold" />
        )}
      </div>
    </div>
  );
};

export const AddExpense = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { categories, loadingCategories } = useCategory();
  const { user } = useAuth();

  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiptFile, setReceiptFile] = useState(() =>
    typeof File !== 'undefined' && location.state?.receiptFile instanceof File
      ? location.state.receiptFile
      : null
  );
  const [receiptPreview, setReceiptPreview] = useState(() => location.state?.receiptPreview || null);
  const [showAllCategories, setShowAllCategories] = useState(false);

  // Split Expense State
  const [isSplit, setIsSplit] = useState(false);
  const [numberOfSplits, setNumberOfSplits] = useState(3);
  const currentUserName = user?.name ? `${user.name} (You)` : 'You (Current User)';

  const [participants, setParticipants] = useState([
    { personName: 'Rahul', shareAmount: '', isCurrentUser: false },
    { personName: 'Amit', shareAmount: '', isCurrentUser: false },
    { personName: currentUserName, shareAmount: '', isCurrentUser: true },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Update default participant name when user profile loads
  useEffect(() => {
    if (user?.name) {
      setParticipants((prev) =>
        prev.map((p) =>
          p.isCurrentUser ? { ...p, personName: `${user.name} (You)` } : p
        )
      );
    }
  }, [user?.name]);

  // Set default category once categories load
  useEffect(() => {
    if (categories.length > 0 && !selectedCategory) {
      setSelectedCategory(categories[0]._id);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (location.state?.receiptFile instanceof File) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.key, location.pathname, location.state, navigate]);

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

  // Adjust number of participant fields when number of splits changes
  const handleNumberOfSplitsChange = (num) => {
    const targetCount = Math.max(2, Math.min(20, parseInt(num, 10) || 2));
    setNumberOfSplits(targetCount);

    setParticipants((prev) => {
      const currentList = [...prev];
      if (targetCount > currentList.length) {
        const toAdd = targetCount - currentList.length;
        for (let i = 0; i < toAdd; i++) {
          currentList.push({
            personName: `Person ${currentList.length + 1}`,
            shareAmount: '',
            isCurrentUser: false,
          });
        }
      } else if (targetCount < currentList.length) {
        const userItem = currentList.find((p) => p.isCurrentUser);
        const nonUserItems = currentList.filter((p) => !p.isCurrentUser);
        const keptNonUser = nonUserItems.slice(0, targetCount - 1);
        return [...keptNonUser, userItem || { personName: currentUserName, shareAmount: '', isCurrentUser: true }];
      }
      return currentList;
    });
  };

  const handleAddParticipant = () => {
    setParticipants((prev) => {
      const nextNum = prev.length + 1;
      const updated = [
        ...prev,
        {
          personName: `Person ${nextNum}`,
          shareAmount: '',
          isCurrentUser: false,
        },
      ];
      setNumberOfSplits(updated.length);
      return updated;
    });
  };

  const handleRemoveParticipant = (indexToRemove) => {
    if (participants.length <= 2) {
      setError('Split expense requires at least 2 participants');
      return;
    }
    setParticipants((prev) => {
      const updated = prev.filter((_, idx) => idx !== indexToRemove);
      setNumberOfSplits(updated.length);
      return updated;
    });
  };

  const handleParticipantChange = (index, field, value) => {
    setParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Split equally helper
  const handleSplitEqually = () => {
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Enter a total expense amount first to split equally');
      return;
    }
    const count = participants.length;
    const totalPaise = Math.round(parsedAmount * 100);
    const baseSharePaise = Math.floor(totalPaise / count);
    const remainderPaise = totalPaise % count;

    setParticipants((prev) =>
      prev.map((p, idx) => {
        const sharePaise = baseSharePaise + (idx < remainderPaise ? 1 : 0);
        return {
          ...p,
          shareAmount: (sharePaise / 100).toFixed(2),
        };
      })
    );
  };

  // Validation calculations for UI display
  const splitValidation = useMemo(() => {
    if (!isSplit) {
      return { isValid: true, error: '', totalAllocated: 0, remaining: 0 };
    }
    return validateSplitParticipantsClient(participants, amount, user);
  }, [isSplit, participants, amount, user]);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
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

    if (isSplit) {
      const validation = validateSplitParticipantsClient(participants, parsedAmount, user);
      if (!validation.isValid) {
        setError(validation.error);
        return;
      }
    }

    setLoading(true);

    try {
      const categoryObj = categories.find((c) => c._id === selectedCategory);

      await expenseApi.createExpense({
        amount: parsedAmount,
        categoryId: selectedCategory,
        categoryObj,
        date,
        description,
        receiptFile,
        receiptPreview,
        isSplit,
        participants: isSplit
          ? participants.map((p) => ({
              personName: p.personName.trim(),
              shareAmount: parseFloat(p.shareAmount),
              isCurrentUser: Boolean(p.isCurrentUser),
              participantUserId: p.isCurrentUser && user ? (user.id || user._id) : null,
            }))
          : [],
      });

      setSuccessMsg(
        isSplit
          ? 'Split expense saved! Receivables added to Recent list.'
          : 'Expense saved successfully!'
      );

      // Reset form
      setAmount('');
      setDescription('');
      setReceiptFile(null);
      setReceiptPreview(null);
      setDate(new Date().toISOString().slice(0, 10));
      setIsSplit(false);
      setParticipants([
        { personName: 'Rahul', shareAmount: '', isCurrentUser: false },
        { personName: 'Amit', shareAmount: '', isCurrentUser: false },
        { personName: currentUserName, shareAmount: '', isCurrentUser: true },
      ]);
      setNumberOfSplits(3);

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
    <div class="relative w-full max-w-[520px] mx-auto pb-40 md:pb-32 px-4 sm:px-0 space-y-5 pt-1">
      {/* Soft ambient violet glow */}
      <div class="absolute -top-12 -right-8 w-64 h-64 bg-purple-200/35 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Feedback alerts */}
      {error && (
        <div class="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl text-xs font-medium flex items-center gap-2">
          <Icon name="error" className="text-[18px] shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div class="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-2xl text-xs font-medium flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Icon name="check_circle" className="text-[18px] shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            class="underline font-bold hover:opacity-80 ml-2"
          >
            Dashboard →
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} class="space-y-5">
        {/* 1. Total Amount */}
        <div>
          <label class="block text-sm font-bold text-slate-800 mb-2">
            Total Amount
          </label>
          <div class="rounded-[24px] bg-[#EEF2FF]/60 border border-[#E0E7FF]/70 p-4 px-6 flex items-center gap-4 focus-within:border-[#43189E]/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#43189E]/10 transition-all">
            <span class="text-[28px] font-bold text-slate-900 select-none">₹</span>
            <div class="w-px h-8 bg-slate-300/60" />
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
              class="bg-transparent border-none text-[32px] md:text-[36px] font-extrabold text-slate-900 placeholder:text-slate-400 w-full p-0 font-numeric-display outline-none"
            />
          </div>
        </div>

        {/* 2. Category Section */}
        <div>
          <div class="flex items-center justify-between mb-2.5">
            <label class="text-sm font-bold text-slate-800">
              Category
            </label>
            {categories.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllCategories((v) => !v)}
                class="text-xs font-semibold text-[#43189E] hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <span>{showAllCategories ? 'Less' : 'More'}</span>
                <Icon name={showAllCategories ? 'chevron_up' : 'chevron_right'} className="text-[14px]" />
              </button>
            )}
          </div>

          {loadingCategories ? (
            <div class="py-4 text-center text-xs text-slate-400">Loading categories...</div>
          ) : (
            <div class="grid grid-cols-4 gap-2.5 sm:gap-3">
              {(showAllCategories ? categories : categories.slice(0, 4)).map((cat) => {
                const isSelected = selectedCategory === cat._id;
                return (
                  <button
                    key={cat._id}
                    type="button"
                    onClick={() => setSelectedCategory(cat._id)}
                    class={`rounded-[22px] p-3.5 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1E1B8F] text-white shadow-md shadow-indigo-950/20 font-semibold'
                        : 'bg-white border border-slate-100 text-slate-800 shadow-2xs hover:bg-slate-50 font-medium'
                    }`}
                  >
                    <CategoryIcon name={cat.icon} className="text-[22px]" />
                    <span class="text-xs truncate w-full text-center">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3. Description / Title */}
        <div>
          <label class="block text-sm font-bold text-slate-800 mb-2" htmlFor="description">
            Description / Title
          </label>
          <div class="rounded-[20px] bg-[#F8FAFC] border border-slate-200/80 px-4 py-3.5 flex items-center gap-3 focus-within:border-[#43189E]/50 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#43189E]/10 transition-all">
            <Icon name="edit" className="text-slate-400 text-[18px] shrink-0" />
            <input
              id="description"
              type="text"
              placeholder="e.g. Dinner with friends"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              class="bg-transparent border-none text-sm text-slate-900 placeholder:text-slate-400 w-full p-0 outline-none"
            />
          </div>
        </div>

        {/* 4. Date */}
        <div>
          <label class="block text-sm font-bold text-slate-800 mb-2" htmlFor="date">
            Date
          </label>
          <div class="relative rounded-[20px] bg-[#F8FAFC] border border-slate-200/80 px-4 py-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer">
            <div class="flex items-center gap-3 w-full">
              <Icon name="calendar_month" className="text-slate-700 text-[20px] shrink-0 pointer-events-none" />
              <input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                class="bg-transparent border-none text-sm font-semibold text-slate-800 outline-none w-full cursor-pointer"
              />
            </div>
            <Icon name="chevron_down" className="text-slate-400 text-[20px] shrink-0 pointer-events-none ml-2" />
          </div>
        </div>

        {/* 5. Split Expense Toggle Card */}
        <div class="rounded-[22px] bg-white border border-slate-100 p-4 shadow-2xs transition-all">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-11 h-11 rounded-2xl bg-[#EDE9FE] text-[#6D28D9] flex items-center justify-center shrink-0">
                <Icon name="people" className="text-[22px]" />
              </div>
              <div>
                <h3 class="text-sm font-bold text-slate-900">
                  Split Expense
                </h3>
                <p class="text-xs text-slate-400 mt-0.5">
                  Track money owed back
                </p>
              </div>
            </div>

            {/* iOS style toggle */}
            <label class="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isSplit}
                onChange={(e) => setIsSplit(e.target.checked)}
                class="sr-only peer"
              />
              <div class="w-12 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1E1B8F]"></div>
            </label>
          </div>

          {/* Expandable Split Details Section */}
          {isSplit && (
            <div class="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-fadeIn">
              {/* Number of splits & Equal distribution controls */}
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC] p-3 rounded-2xl border border-slate-100">
                <div class="flex items-center gap-2">
                  <label class="text-xs font-semibold text-slate-700">Number of Splits:</label>
                  <input
                    type="number"
                    min="2"
                    max="20"
                    value={numberOfSplits}
                    onChange={(e) => handleNumberOfSplitsChange(e.target.value)}
                    class="w-16 h-8 text-center bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 outline-none focus:border-[#1E1B8F]"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSplitEqually}
                  class="text-xs bg-[#EDE9FE] text-[#6D28D9] hover:bg-[#DDD6FE] px-3 py-1.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Icon name="swap_horiz" className="text-[16px]" /> Split Equally
                </button>
              </div>

              {/* Dynamic Participant Input List */}
              <div class="space-y-2.5">
                {participants.map((p, index) => (
                  <div
                    key={index}
                    class={`p-3.5 rounded-2xl border transition-all ${
                      p.isCurrentUser
                        ? 'bg-[#EEF2FF]/50 border-[#C7D2FE]'
                        : 'bg-white border-slate-100 shadow-2xs'
                    }`}
                  >
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs text-slate-500 font-semibold flex items-center gap-1.5">
                        {p.isCurrentUser ? (
                          <>
                            <span class="w-2 h-2 rounded-full bg-[#1E1B8F] inline-block"></span>
                            Participant {index + 1} (Your Share)
                          </>
                        ) : (
                          <>
                            Participant {index + 1}
                          </>
                        )}
                      </span>
                      {!p.isCurrentUser && participants.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveParticipant(index)}
                          class="text-rose-500 hover:bg-rose-50 px-2 py-0.5 rounded text-xs flex items-center gap-0.5 cursor-pointer"
                          title="Remove participant"
                        >
                          <Icon name="close" className="text-[14px]" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label class="block text-[11px] text-slate-400 uppercase mb-1 font-medium">
                          Name
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul"
                          value={p.personName}
                          disabled={p.isCurrentUser}
                          onChange={(e) => handleParticipantChange(index, 'personName', e.target.value)}
                          class={`w-full h-10 px-3 rounded-xl border text-sm font-medium outline-none ${
                            p.isCurrentUser
                              ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                              : 'bg-[#F8FAFC] text-slate-800 border-slate-200 focus:border-[#1E1B8F] focus:bg-white'
                          }`}
                        />
                      </div>

                      <div>
                        <label class="block text-[11px] text-slate-400 uppercase mb-1 font-medium">
                          Share Amount (₹)
                        </label>
                        <div class="relative">
                          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₹</span>
                          <input
                            type="number"
                            step="any"
                            min="0"
                            required
                            placeholder="0.00"
                            value={p.shareAmount}
                            onChange={(e) => handleParticipantChange(index, 'shareAmount', e.target.value)}
                            class="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-slate-800 text-sm font-bold focus:border-[#1E1B8F] focus:bg-white outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Participant Control */}
              <button
                type="button"
                onClick={handleAddParticipant}
                class="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-200 text-[#43189E] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Icon name="add" className="text-[16px]" />
                Add Person
              </button>

              {/* Allocation Summary Card */}
              <div class="bg-[#F8FAFC] border border-slate-100 rounded-2xl p-3.5 space-y-1.5 text-xs">
                <div class="flex justify-between items-center text-slate-500">
                  <span>Total Expense:</span>
                  <span class="font-bold text-slate-800">₹{(parseFloat(amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="flex justify-between items-center text-slate-500">
                  <span>Total Allocated:</span>
                  <span class="font-bold text-slate-800">₹{(splitValidation.totalAllocated || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div class="flex justify-between items-center pt-1.5 border-t border-slate-200/80">
                  <span class="font-medium text-slate-700">Allocation Status:</span>
                  <span class={`font-bold ${
                    splitValidation.isValid ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {splitValidation.isValid ? (
                      'Fully Allocated (₹0 remaining)'
                    ) : (
                      splitValidation.error
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 6. Receipt Section */}
        <div>
          <label class="block text-sm font-bold text-slate-800 mb-2">
            Receipt
          </label>
          {receiptPreview ? (
            <div class="rounded-[20px] border border-slate-200/80 bg-white p-3.5 flex items-center justify-between gap-3 shadow-2xs">
              <div class="flex items-center gap-3 min-w-0">
                <img src={receiptPreview} alt="Receipt preview" class="w-12 h-12 object-cover rounded-xl border border-slate-200" />
                <div class="min-w-0">
                  <p class="text-xs font-semibold text-slate-900 truncate">{receiptFile?.name || 'Receipt Image'}</p>
                  <p class="text-[11px] text-slate-400 mt-0.5">
                    {receiptFile?.size ? `${(receiptFile.size / 1024).toFixed(1)} KB` : 'Attached'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={removeReceipt}
                class="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                title="Remove receipt"
              >
                <Icon name="delete" className="text-[18px]" />
              </button>
            </div>
          ) : (
            <label class="rounded-[20px] border-2 border-dashed border-[#C7D2FE] bg-[#F8FAFF] py-4 px-4 flex items-center justify-center gap-2 hover:bg-[#EEF2FF]/60 transition-colors cursor-pointer group">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleReceiptChange}
                class="hidden"
              />
              <Icon name="cloud_upload" className="text-[20px] text-[#43189E] group-hover:scale-110 transition-transform" />
              <span class="text-sm font-semibold text-[#43189E]">Add Receipt</span>
              <span class="text-xs text-slate-400 font-normal">(Optional)</span>
            </label>
          )}
        </div>
      </form>

      {/* 7. Fixed Slide to Save Expense Button above Bottom Navigation Bar */}
      <div class="fixed bottom-[84px] md:bottom-6 left-0 right-0 z-40 px-4 pointer-events-none">
        <div class="w-full max-w-[520px] mx-auto pointer-events-auto">
          <SlideToSaveButton
            onConfirm={handleSubmit}
            loading={loading}
            disabled={loading || (isSplit && !splitValidation.isValid)}
          />
        </div>
      </div>
    </div>
  );
};
