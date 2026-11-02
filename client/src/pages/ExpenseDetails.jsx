import { CategoryIcon, Icon } from '../components/Icon.jsx';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { expenseApi } from '../services/expenseApi';
import { useCategory } from '../context/CategoryContext';
import { useAuth } from '../context/AuthContext';
import { getReceiptUrl } from '../services/api';
import { validateSplitParticipantsClient } from '../services/transactionUtils';

export const ExpenseDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { categories } = useCategory();
  const { user } = useAuth();

  const [expense, setExpense] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals & Edit States
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [isReceiptExpanded, setIsReceiptExpanded] = useState(false);

  // Edit form state
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('success');
  const [editMerchantUpiId, setEditMerchantUpiId] = useState('');
  const [editExternalTransactionReference, setEditExternalTransactionReference] = useState('');
  const [newReceiptFile, setNewReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // Split Expense Edit State
  const [editIsSplit, setEditIsSplit] = useState(false);
  const [editParticipants, setEditParticipants] = useState([]);

  // Record Payment Modal State
  const [selectedReceivableForPayment, setSelectedReceivableForPayment] = useState(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState('');
  const [paymentNotesInput, setPaymentNotesInput] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [paymentDialogError, setPaymentDialogError] = useState('');

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
      setEditPaymentStatus(data.paymentStatus || 'success');
      setEditMerchantUpiId(data.merchantUpiId || '');
      setEditExternalTransactionReference(data.externalTransactionReference || '');
      setEditIsSplit(Boolean(data.isSplit));
      setEditParticipants(
        Array.isArray(data.participants) && data.participants.length > 0
          ? data.participants.map((p) => ({
              _id: p._id,
              personName: p.personName,
              shareAmount: p.shareAmount,
              amountPaidBack: p.amountPaidBack || 0,
              paymentStatus: p.paymentStatus,
              isCurrentUser: Boolean(p.isCurrentUser),
              paymentHistory: p.paymentHistory || [],
            }))
          : []
      );
    } catch (err) {
      setError(err.message || 'Failed to load expense details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpense();
  }, [id]);

  const handleOpenPaymentDialog = (participant, outstanding) => {
    setSelectedReceivableForPayment({
      _id: participant._id,
      personName: participant.personName,
      shareAmount: participant.shareAmount,
      amountPaidBack: participant.amountPaidBack || 0,
      outstandingAmount: outstanding,
      expenseId: { description: expense?.description || 'Expense' },
    });
    setPaymentAmountInput(outstanding.toString());
    setPaymentNotesInput('');
    setPaymentDialogError('');
  };

  const handleClosePaymentDialog = () => {
    if (recordingPayment) return;
    setSelectedReceivableForPayment(null);
    setPaymentAmountInput('');
    setPaymentNotesInput('');
    setPaymentDialogError('');
  };

  const handleConfirmPayment = async (e) => {
    if (e) e.preventDefault();
    if (!selectedReceivableForPayment) return;

    setPaymentDialogError('');
    const amt = parseFloat(paymentAmountInput);
    if (isNaN(amt) || amt <= 0) {
      setPaymentDialogError('Please enter a valid amount greater than 0');
      return;
    }

    if (amt > selectedReceivableForPayment.outstandingAmount) {
      setPaymentDialogError(
        `Amount cannot exceed outstanding balance ₹${selectedReceivableForPayment.outstandingAmount.toFixed(2)}`
      );
      return;
    }

    setRecordingPayment(true);
    try {
      await expenseApi.recordParticipantPayment(
        selectedReceivableForPayment._id,
        amt,
        paymentNotesInput
      );
      handleClosePaymentDialog();
      await fetchExpense();
    } catch (err) {
      setPaymentDialogError(err.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

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
      const currentCategoryId = expense.categoryId?._id || expense.categoryId;
      const updated = await expenseApi.updateExpense(
        id,
        formData,
        categories.find((category) => category._id === currentCategoryId)
      );
      setExpense(updated);
      setNewReceiptFile(null);
      setReceiptPreview(null);
    } catch (err) {
      setError(err.message || 'Failed to remove receipt');
    } finally {
      setSaving(false);
    }
  };

  const handleParticipantChange = (index, field, value) => {
    setEditParticipants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveEdit = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (editIsSplit) {
      const validation = validateSplitParticipantsClient(editParticipants, editAmount, user);
      if (!validation.isValid) {
        setError(validation.error);
        return;
      }

      // Check if any participant already paid more than the new share amount
      for (const p of editParticipants) {
        const share = parseFloat(p.shareAmount) || 0;
        const paid = p.amountPaidBack || 0;
        if (paid > share) {
          setError(
            `Participant "${p.personName}" has already paid ₹${paid.toFixed(2)}, which exceeds their new share amount ₹${share.toFixed(2)}.`
          );
          return;
        }
      }
    }

    setSaving(true);

    try {
      const formData = new FormData();
      formData.append('amount', editAmount);
      formData.append('categoryId', editCategory);
      formData.append('description', editDescription);
      formData.append('date', editDate);
      formData.append('paymentStatus', editPaymentStatus);
      formData.append('merchantUpiId', editMerchantUpiId);
      formData.append('externalTransactionReference', editExternalTransactionReference);
      formData.append('isSplit', editIsSplit);
      if (editIsSplit) {
        formData.append('participants', JSON.stringify(editParticipants));
      }

      if (newReceiptFile) {
        formData.append('receipt', newReceiptFile);
      }

      const updated = await expenseApi.updateExpense(
        id,
        formData,
        categories.find((category) => category._id === editCategory)
      );
      setExpense(updated);
      setIsEditing(false);
      setNewReceiptFile(null);
      setReceiptPreview(null);
      await fetchExpense();
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
          <Icon name="arrow_back" className="" />
          <span class="font-title-md text-title-md">Back</span>
        </button>
        <h1 class="font-title-md text-title-md text-primary font-bold">Expense Details</h1>
        <div class="w-16"></div>
      </div>

      {error && (
        <div class="mb-4 bg-error-container text-on-error-container px-4 py-3 rounded-lg font-body-sm flex items-center gap-2">
          <Icon name="error" className="text-[20px]" />
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
                step="0.01"
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
                    {cat.name}
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

            {/* Split Details Section if Expense is Split */}
            {editIsSplit && editParticipants.length > 0 && (
              <div class="border border-outline-variant rounded-xl p-4 bg-surface-bright space-y-3">
                <div class="flex items-center justify-between">
                  <h4 class="font-title-md text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <Icon name="group" className="text-primary text-[18px]" />
                    Split Allocations
                  </h4>
                  <span class="text-xs text-on-surface-variant">
                    Total: ₹{editAmount}
                  </span>
                </div>

                <div class="space-y-2">
                  {editParticipants.map((p, idx) => (
                    <div key={idx} class="flex items-center gap-2 p-2 rounded bg-surface-container-low border border-outline-variant/60">
                      <div class="flex-1">
                        <span class="font-medium text-xs block text-on-surface">
                          {p.personName} {p.isCurrentUser ? '(You)' : ''}
                        </span>
                        {p.amountPaidBack > 0 && (
                          <span class="text-[11px] text-primary">
                            Already paid: ₹{p.amountPaidBack.toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div class="w-28 relative">
                        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-on-surface-variant">₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min={p.amountPaidBack || 0.01}
                          required
                          value={p.shareAmount}
                          onChange={(e) => handleParticipantChange(idx, 'shareAmount', e.target.value)}
                          class="w-full h-8 pl-6 pr-2 rounded border border-outline-variant text-xs font-semibold bg-surface-bright outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1" htmlFor="payment-status">
                Payment status
              </label>
              <select
                id="payment-status"
                value={editPaymentStatus}
                onChange={(event) => setEditPaymentStatus(event.target.value)}
                class="w-full h-12 bg-surface-bright border border-outline-variant rounded-lg px-4 font-body-lg text-on-surface outline-none"
              >
                <option value="pending">Pending</option>
                <option value="unknown">Unknown</option>
                <option value="success">Confirmed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div>
              <label class="font-label-caps text-label-caps text-on-surface-variant uppercase block mb-1">
                Receipt Image
              </label>
              {expense.receiptUrl && !receiptPreview && (
                <div class="mb-2 flex items-center gap-3">
                  <img src={getReceiptUrl(expense.receiptUrl)} alt="Receipt" class="w-16 h-16 object-cover rounded border" />
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
              <div class="w-16 h-16 bg-surface-container-low rounded-xl flex items-center justify-center mb-2 text-primary shadow-xs">
                <CategoryIcon name={expense.categoryId?.icon} className="text-3xl" />
              </div>
              <h2 class="font-numeric-display text-[32px] md:text-[36px] text-on-surface font-bold">
                ₹{expense.amount.toLocaleString('en-IN')}
              </h2>
              <p class="font-body-lg text-on-surface-variant font-medium">
                {expense.categoryId?.name || 'Expense'}
              </p>
              {expense.isSplit && (
                <span class="mt-2 text-xs bg-primary/10 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-semibold flex items-center gap-1">
                  <Icon name="group" className="text-[14px]" /> Split Expense
                </span>
              )}
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
                  <button
                    onClick={() => setIsEditing(true)}
                    class="text-primary font-title-md text-[14px] flex items-center gap-1 hover:bg-surface-container-low px-2 py-1 rounded transition-colors"
                  >
                    <Icon name="edit" className="text-[18px]" /> Edit
                  </button>
                </div>
                {expense.description ? (
                  <span class="font-body-lg text-on-surface">{expense.description}</span>
                ) : (
                  <span class="font-body-lg text-outline italic">No description added</span>
                )}
              </div>

              {/* Split Breakdown Details if Split */}
              {expense.isSplit && Array.isArray(expense.participants) && expense.participants.length > 0 && (
                <div class="pt-4 border-t border-outline-variant space-y-3">
                  <h4 class="font-title-md text-sm font-bold text-on-surface flex items-center gap-1.5">
                    <Icon name="group" className="text-primary text-[18px]" />
                    Participants Breakdown
                  </h4>
                  <div class="divide-y divide-outline-variant/60 border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low/40">
                    {expense.participants.map((p) => {
                      const share = p.shareAmount || 0;
                      const paid = p.amountPaidBack || 0;
                      const outstanding = Math.max(0, share - paid);

                      return (
                        <div key={p._id || p.personName} class="p-3 flex items-center justify-between text-sm">
                          <div>
                            <p class="font-semibold text-on-surface">
                              {p.personName} {p.isCurrentUser ? '(You)' : ''}
                            </p>
                            <p class="text-xs text-on-surface-variant mt-0.5">
                              Share: ₹{share.toLocaleString('en-IN')} · Paid: ₹{paid.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div class="text-right flex flex-col items-end gap-1.5 shrink-0">
                            {p.isCurrentUser ? (
                              <span class="text-xs bg-surface-container text-on-surface-variant px-2 py-0.5 rounded font-medium">
                                Personal Share
                              </span>
                            ) : (
                              <>
                                <div class="flex items-center gap-1.5">
                                  <span class={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                    p.paymentStatus === 'RECEIVED'
                                      ? 'bg-green-100 text-green-800'
                                      : p.paymentStatus === 'PARTIALLY_PAID'
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-red-50 text-red-700'
                                  }`}>
                                    {p.paymentStatus || 'PENDING'}
                                  </span>
                                  {outstanding > 0 && (
                                    <span class="text-xs text-primary font-bold">
                                      Owes ₹{outstanding.toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                                {outstanding > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPaymentDialog(p, outstanding)}
                                    class="px-2.5 py-1 bg-primary hover:bg-primary-container text-on-primary rounded-lg font-title-md text-xs font-semibold shadow-xs flex items-center gap-1 transition-all active:scale-95"
                                  >
                                    <Icon name="check" className="text-[14px]" />
                                    Mark as Received
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Actions: Edit */}
            <button
              onClick={() => setIsEditing(true)}
              class="w-full min-h-[44px] border border-primary text-primary hover:bg-surface-container-low font-title-md rounded-lg flex items-center justify-center gap-2 transition-colors mt-2"
            >
              <Icon name="edit" className="text-[20px]" />
              Edit Expense
            </button>
          </div>

          {/* Secondary Column: Receipt & Delete */}
          <div class="w-full md:w-1/3 flex flex-col gap-6">
            {/* Encapsulated Collapsible Receipt Card */}
            <div class="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden transition-all">
              {/* Capsule Toggle Header */}
              <button
                type="button"
                onClick={() => setIsReceiptExpanded(!isReceiptExpanded)}
                class="w-full p-4 flex items-center justify-between text-left hover:bg-surface-container-low/60 transition-colors cursor-pointer select-none"
                aria-expanded={isReceiptExpanded}
              >
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                    <Icon name="receipt_long" className="text-[20px]" />
                  </div>
                  <div>
                    <div class="flex items-center gap-2">
                      <h3 class="font-title-md text-sm font-semibold text-on-surface">Receipt</h3>
                      {expense.receiptUrl ? (
                        <span class="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-semibold">
                          Attached
                        </span>
                      ) : (
                        <span class="text-[10px] bg-surface-container text-on-surface-variant px-2 py-0.5 rounded-full font-medium">
                          None
                        </span>
                      )}
                    </div>
                    <p class="text-xs text-on-surface-variant mt-0.5">
                      {expense.receiptUrl
                        ? (isReceiptExpanded ? 'Click to collapse' : 'Click to preview receipt')
                        : 'No receipt attached'}
                    </p>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  {!isReceiptExpanded && expense.receiptUrl && (
                    <img
                      src={getReceiptUrl(expense.receiptUrl)}
                      alt="Thumbnail"
                      class="w-8 h-8 object-cover rounded border border-outline-variant/60"
                    />
                  )}
                  <Icon
                    name={isReceiptExpanded ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                    className="text-on-surface-variant text-[22px]"
                  />
                </div>
              </button>

              {/* Collapsible Content */}
              {isReceiptExpanded && (
                <div class="p-4 pt-2 border-t border-outline-variant/60 space-y-3">
                  {expense.receiptUrl ? (
                    <div>
                      <div
                        onClick={() => setShowImageZoom(true)}
                        class="relative w-full aspect-[3/4] max-h-[360px] bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant group cursor-pointer mb-3"
                      >
                        <img
                          src={getReceiptUrl(expense.receiptUrl)}
                          alt="Receipt"
                          class="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                        />
                        <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Icon name="zoom_in" className="text-white text-[32px] bg-black/40 rounded-full p-2" />
                        </div>
                      </div>

                      <div class="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditing(true)}
                          class="flex-1 min-h-[38px] bg-surface border border-outline-variant text-on-surface rounded-lg font-title-md text-[13px] flex items-center justify-center gap-1 hover:bg-surface-container-low transition-colors"
                        >
                          <Icon name="swap_horiz" className="text-[16px]" /> Replace
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveReceipt}
                          class="flex-1 min-h-[38px] bg-surface border border-error text-error rounded-lg font-title-md text-[13px] flex items-center justify-center gap-1 hover:bg-error-container/40 transition-colors"
                        >
                          <Icon name="delete" className="text-[16px]" /> Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div class="py-4 text-center flex flex-col items-center gap-2.5">
                      <p class="font-body-sm text-xs text-on-surface-variant">No receipt added</p>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        class="px-3.5 py-1.5 bg-surface-container text-primary font-title-md text-xs rounded-lg hover:bg-surface-container-high flex items-center gap-1 border border-outline-variant/60"
                      >
                        <Icon name="add" className="text-[16px]" /> Add Receipt
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delete Expense */}
            <button
              onClick={() => setShowDeleteModal(true)}
              class="w-full min-h-[48px] bg-surface-container-lowest border border-error text-error rounded-xl font-title-md flex items-center justify-center gap-2 hover:bg-error-container/40 transition-colors active:scale-98"
            >
              <Icon name="delete" className="" />
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
              This action cannot be undone. Any split records linked to this expense will also be removed.
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
            <img src={getReceiptUrl(expense?.receiptUrl)} alt="Receipt Fullscreen" class="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <button
              onClick={() => setShowImageZoom(false)}
              class="absolute top-2 right-2 bg-black/60 text-white rounded-full p-2 hover:bg-black"
            >
              <Icon name="close" className="" />
            </button>
          </div>
        </div>
      )}

      {/* Confirmation & Partial Payment Modal Dialog */}
      {selectedReceivableForPayment && (
        <div class="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
          <div class="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 w-full max-w-[440px] shadow-xl space-y-4">
            <div class="flex items-center justify-between border-b pb-3 border-outline-variant">
              <h3 class="font-title-md text-lg font-bold text-on-surface flex items-center gap-2">
                <Icon name="payments" className="text-primary text-[22px]" />
                Record Received Payment
              </h3>
              <button
                type="button"
                onClick={handleClosePaymentDialog}
                disabled={recordingPayment}
                class="text-on-surface-variant hover:text-on-surface p-1 rounded-full"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            {paymentDialogError && (
              <div class="bg-error-container text-on-error-container px-3 py-2 rounded-lg text-xs flex items-center gap-2">
                <Icon name="error" className="text-[16px]" />
                <span>{paymentDialogError}</span>
              </div>
            )}

            <div class="space-y-2 text-sm bg-surface-container-low p-3.5 rounded-xl border border-outline-variant">
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Participant:</span>
                <span class="font-bold text-on-surface">{selectedReceivableForPayment.personName}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Associated Expense:</span>
                <span class="font-medium text-on-surface">{selectedReceivableForPayment.expenseId?.description || 'Expense'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Full Share Amount:</span>
                <span class="font-medium text-on-surface">₹{selectedReceivableForPayment.shareAmount.toFixed(2)}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-on-surface-variant">Already Received:</span>
                <span class="font-medium text-on-surface">₹{(selectedReceivableForPayment.amountPaidBack || 0).toFixed(2)}</span>
              </div>
              <div class="flex justify-between border-t border-outline-variant/60 pt-1.5 font-bold">
                <span class="text-on-surface">Outstanding Balance:</span>
                <span class="text-primary text-base">₹{selectedReceivableForPayment.outstandingAmount.toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmPayment} class="space-y-3">
              <div>
                <label class="block font-label-caps text-xs text-on-surface-variant uppercase mb-1">
                  Amount Received (₹)
                </label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-on-surface-variant">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={selectedReceivableForPayment.outstandingAmount}
                    required
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    class="w-full h-11 pl-8 pr-3 rounded-lg border border-outline-variant bg-surface-bright text-on-surface font-bold text-base focus:border-primary outline-none"
                  />
                </div>
                <div class="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setPaymentAmountInput(selectedReceivableForPayment.outstandingAmount.toString())}
                    class="text-xs text-primary underline hover:opacity-80"
                  >
                    Full remaining (₹{selectedReceivableForPayment.outstandingAmount.toFixed(2)})
                  </button>
                  {selectedReceivableForPayment.outstandingAmount > 100 && (
                    <button
                      type="button"
                      onClick={() => setPaymentAmountInput((selectedReceivableForPayment.outstandingAmount / 2).toFixed(2))}
                      class="text-xs text-on-surface-variant underline hover:text-primary"
                    >
                      50% (₹{(selectedReceivableForPayment.outstandingAmount / 2).toFixed(2)})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label class="block font-label-caps text-xs text-on-surface-variant uppercase mb-1">
                  Notes / Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via GPay"
                  value={paymentNotesInput}
                  onChange={(e) => setPaymentNotesInput(e.target.value)}
                  class="w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-bright text-on-surface text-sm outline-none focus:border-primary"
                />
              </div>

              <div class="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={handleClosePaymentDialog}
                  disabled={recordingPayment}
                  class="flex-1 h-11 border border-outline-variant text-on-surface rounded-xl font-title-md text-sm hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordingPayment}
                  class="flex-1 h-11 bg-primary text-on-primary rounded-xl font-title-md text-sm hover:bg-primary-container transition-all flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
                >
                  {recordingPayment ? (
                    <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Icon name="check_circle" className="text-[18px]" />
                      Confirm Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
