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
    return total + getAmountPaise(transaction);
  }, 0) / 100;
