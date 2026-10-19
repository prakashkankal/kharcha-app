export const TRANSACTION_TYPES = ['expense', 'income', 'transfer'];
export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'other'];
export const PAYMENT_STATUSES = ['pending', 'success', 'failed', 'cancelled', 'unknown'];
export const WALLETS = ['cash', 'bank'];

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
