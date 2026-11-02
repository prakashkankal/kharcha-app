export const TRANSACTION_TYPES = ['expense', 'income', 'transfer'];
export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'other'];
export const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'cancelled', 'unknown'];
export const WALLETS = ['cash', 'bank'];
export const SPLIT_PAYMENT_STATUSES = ['PENDING', 'PARTIALLY_PAID', 'RECEIVED'];

export const parseTransactionFields = (body, { defaults = true } = {}) => {
  const transactionType = body.transactionType ?? (defaults ? 'expense' : undefined);
  const paymentMethod = body.paymentMethod ?? (defaults ? 'other' : undefined);
  const paymentStatus = body.paymentStatus ?? (defaults ? 'success' : undefined);
  const fromWallet = body.fromWallet;
  const toWallet = body.toWallet;

  if (transactionType !== undefined && !TRANSACTION_TYPES.includes(transactionType)) {
    return { error: 'Invalid transaction type' };
  }
  if (paymentMethod !== undefined && !PAYMENT_METHODS.includes(paymentMethod)) {
    return { error: 'Invalid payment method' };
  }
  if (paymentStatus !== undefined && !PAYMENT_STATUSES.includes(paymentStatus)) {
    return { error: 'Invalid payment status' };
  }
  if (fromWallet !== undefined && !WALLETS.includes(fromWallet)) {
    return { error: 'Invalid source wallet' };
  }
  if (toWallet !== undefined && !WALLETS.includes(toWallet)) {
    return { error: 'Invalid destination wallet' };
  }
  if (transactionType === 'transfer' && (!fromWallet || !toWallet || fromWallet === toWallet)) {
    return { error: 'A transfer requires different source and destination wallets' };
  }

  return { transactionType, paymentMethod, paymentStatus, fromWallet, toWallet };
};

export const parseAmount = (amount) => {
  const parsedAmount = Number(amount);
  const roundedPaise = Math.round(parsedAmount * 100);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || Math.abs(roundedPaise - parsedAmount * 100) > 1e-7) {
    return null;
  }
  return parsedAmount;
};

/**
 * Validate and normalize split participants array
 * @param {Array} participants
 * @param {number} totalAmount
 * @param {object} currentUser - { _id, name }
 * @returns { { error?: string, participants?: Array, totalAllocatedPaise?: number } }
 */
export const validateSplitParticipants = (participants, totalAmount, currentUser = null) => {
  if (!Array.isArray(participants) || participants.length === 0) {
    return { error: 'Split participants list cannot be empty when split is enabled' };
  }

  const totalPaise = Math.round(Number(totalAmount) * 100);
  if (!Number.isFinite(totalPaise) || totalPaise <= 0) {
    return { error: 'Total expense amount must be a positive number' };
  }

  let totalAllocatedPaise = 0;
  const sanitized = [];
  const nameSet = new Set();
  let currentUserCount = 0;

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const name = (p.personName || p.name || '').trim();
    if (!name) {
      return { error: `Participant #${i + 1} must have a valid name` };
    }

    const lowerName = name.toLowerCase();
    if (nameSet.has(lowerName)) {
      return { error: `Duplicate participant name "${name}". Each participant must have a distinct name.` };
    }
    nameSet.add(lowerName);

    const share = Number(p.shareAmount ?? p.share);
    const sharePaise = Math.round(share * 100);
    if (!Number.isFinite(share) || share <= 0 || Math.abs(sharePaise - share * 100) > 1e-7) {
      return { error: `Participant "${name}" must have a valid positive share amount with at most 2 decimal places` };
    }

    totalAllocatedPaise += sharePaise;

    const isCurrentUser = Boolean(
      p.isCurrentUser ||
      (currentUser && (
        (p.participantUserId && String(p.participantUserId) === String(currentUser._id || currentUser.id)) ||
        (p.isSelf)
      ))
    );

    if (isCurrentUser) {
      currentUserCount++;
    }

    const amountPaidBack = Number(p.amountPaidBack || 0);
    const amountPaidBackPaise = Math.round(amountPaidBack * 100);
    if (amountPaidBackPaise < 0 || amountPaidBackPaise > sharePaise) {
      return { error: `Participant "${name}" has an invalid amount paid back` };
    }

    sanitized.push({
      _id: p._id || p.id,
      personName: name,
      participantUserId: p.participantUserId || (isCurrentUser && currentUser ? (currentUser._id || currentUser.id) : null),
      isCurrentUser,
      shareAmount: share,
      shareAmountPaise: sharePaise,
      amountPaidBack,
      amountPaidBackPaise,
      paymentHistory: Array.isArray(p.paymentHistory) ? p.paymentHistory : [],
    });
  }

  if (totalAllocatedPaise !== totalPaise) {
    const diffPaise = totalPaise - totalAllocatedPaise;
    const diffRupees = (Math.abs(diffPaise) / 100).toFixed(2);
    if (diffPaise > 0) {
      return { error: `₹${diffRupees} remaining to allocate.` };
    } else {
      return { error: `Allocated amount exceeds the expense by ₹${diffRupees}.` };
    }
  }

  return {
    participants: sanitized,
    totalAllocatedPaise,
    currentUserCount,
  };
};
