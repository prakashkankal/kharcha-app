export const toPaise = (amount) => Math.round((Number(amount) || 0) * 100);

export const getAmountPaise = (transaction) => {
  const amountPaise = Number(transaction?.amountPaise);
  return Number.isInteger(amountPaise) ? amountPaise : toPaise(transaction?.amount);
};

export const isConfirmedTransaction = (transaction) =>
  !transaction.paymentStatus || transaction.paymentStatus === 'success';

export const getTransactionType = (transaction) => transaction.transactionType || 'expense';

export const calculateWalletBalances = (transactions, openingBalances = {}) => {
  const balances = {
    cash: toPaise(openingBalances.cash),
    bank: toPaise(openingBalances.bank),
  };

  for (const transaction of transactions) {
    if (!isConfirmedTransaction(transaction)) continue;

    const amount = getAmountPaise(transaction);
    const type = getTransactionType(transaction);

    if (type === 'income') {
      if (transaction.paymentMethod === 'cash') balances.cash += amount;
      if (transaction.paymentMethod === 'upi' || transaction.paymentMethod === 'card') balances.bank += amount;
    } else if (type === 'expense') {
      if (transaction.paymentMethod === 'cash') balances.cash -= amount;
      if (transaction.paymentMethod === 'upi' || transaction.paymentMethod === 'card') balances.bank -= amount;
    } else if (type === 'transfer') {
      if (transaction.fromWallet === 'cash') balances.cash -= amount;
      if (transaction.fromWallet === 'bank') balances.bank -= amount;
      if (transaction.toWallet === 'cash') balances.cash += amount;
      if (transaction.toWallet === 'bank') balances.bank += amount;
    }
  }

  return {
    cash: balances.cash / 100,
    bank: balances.bank / 100,
    total: (balances.cash + balances.bank) / 100,
  };
};

export const getSpendingTotal = (transactions) =>
  transactions.reduce((total, transaction) => {
    if (getTransactionType(transaction) !== 'expense' || !isConfirmedTransaction(transaction)) {
      return total;
    }
    return Math.round((total + (Number(transaction.amount) || 0)) * 100) / 100;
  }, 0);

/**
 * Validate split participants on the client
 * @param {Array} participants
 * @param {number|string} totalAmount
 * @param {object} currentUser
 * @returns { { error?: string, totalAllocated: number, remaining: number, isValid: boolean } }
 */
export const validateSplitParticipantsClient = (participants, totalAmount, currentUser = null) => {
  const parsedTotal = parseFloat(totalAmount);
  const totalPaise = Math.round((Number(parsedTotal) || 0) * 100);

  if (isNaN(parsedTotal) || totalPaise <= 0) {
    return {
      error: 'Please enter a valid expense total amount first',
      totalAllocated: 0,
      remaining: 0,
      isValid: false,
    };
  }

  if (!Array.isArray(participants) || participants.length === 0) {
    return {
      error: 'Please add at least one participant',
      totalAllocated: 0,
      remaining: parsedTotal,
      isValid: false,
    };
  }

  let totalAllocatedPaise = 0;
  const nameSet = new Set();

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i];
    const name = (p.personName || p.name || '').trim();
    if (!name) {
      return {
        error: `Participant #${i + 1} must have a valid name`,
        totalAllocated: totalAllocatedPaise / 100,
        remaining: (totalPaise - totalAllocatedPaise) / 100,
        isValid: false,
      };
    }

    const lower = name.toLowerCase();
    if (nameSet.has(lower)) {
      return {
        error: `Duplicate participant name "${name}". Each person must be unique.`,
        totalAllocated: totalAllocatedPaise / 100,
        remaining: (totalPaise - totalAllocatedPaise) / 100,
        isValid: false,
      };
    }
    nameSet.add(lower);

    const share = parseFloat(p.shareAmount);
    const sharePaise = Math.round((Number(share) || 0) * 100);
    if (isNaN(share) || sharePaise <= 0 || Math.abs(sharePaise - share * 100) > 1e-7) {
      return {
        error: `Participant "${name}" must have a positive share amount (max 2 decimals)`,
        totalAllocated: totalAllocatedPaise / 100,
        remaining: (totalPaise - totalAllocatedPaise) / 100,
        isValid: false,
      };
    }

    totalAllocatedPaise += sharePaise;
  }

  const diffPaise = totalPaise - totalAllocatedPaise;
  const diffRupees = (Math.abs(diffPaise) / 100).toFixed(2);

  if (diffPaise > 0) {
    return {
      error: `₹${diffRupees} remaining to allocate.`,
      totalAllocated: totalAllocatedPaise / 100,
      remaining: diffPaise / 100,
      isValid: false,
    };
  } else if (diffPaise < 0) {
    return {
      error: `Allocated amount exceeds the expense by ₹${diffRupees}.`,
      totalAllocated: totalAllocatedPaise / 100,
      remaining: diffPaise / 100,
      isValid: false,
    };
  }

  return {
    error: '',
    totalAllocated: totalAllocatedPaise / 100,
    remaining: 0,
    isValid: true,
  };
};

/**
 * Calculates pending receivables total from a list of split participants
 * Outstanding = shareAmount - amountPaidBack
 * Current user's share is excluded
 */
export const calculatePendingReceivablesTotal = (receivablesList = []) => {
  let totalPaise = 0;
  for (const item of receivablesList) {
    if (item.isCurrentUser) continue;
    const sharePaise = Number(item.shareAmountPaise) || Math.round((Number(item.shareAmount) || 0) * 100);
    const paidPaise = Number(item.amountPaidBackPaise) || Math.round((Number(item.amountPaidBack) || 0) * 100);
    const outstanding = Math.max(0, sharePaise - paidPaise);
    totalPaise += outstanding;
  }
  return totalPaise / 100;
};
