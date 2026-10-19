import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWalletBalances,
  getSpendingTotal,
  toPaise,
} from './transactionUtils.js';

describe('transaction calculations', () => {
  it('keeps wallet and spending totals correct across income, expenses, and transfers', () => {
    const transactions = [
      { amount: 1000, transactionType: 'income', paymentMethod: 'cash' },
      { amount: 100, transactionType: 'expense', paymentMethod: 'cash' },
      { amount: 200, transactionType: 'transfer', fromWallet: 'cash', toWallet: 'bank' },
      { amount: 150, transactionType: 'expense', paymentMethod: 'upi' },
    ];

    assert.deepEqual(calculateWalletBalances(transactions), { cash: 700, bank: 50, total: 750 });
    assert.equal(getSpendingTotal(transactions), 250);
  });

  it('does not count unconfirmed UPI payments in wallet balances or spending', () => {
    const transactions = [
      { amount: 45.5, transactionType: 'expense', paymentMethod: 'upi', paymentStatus: 'pending' },
      { amount: 10, transactionType: 'expense', paymentMethod: 'cash' },
    ];

    assert.deepEqual(calculateWalletBalances(transactions), { cash: -10, bank: 0, total: -10 });
    assert.equal(getSpendingTotal(transactions), 10);
  });

  it('uses integer paise for fractional rupee values', () => {
    assert.equal(toPaise(0.29), 29);
    assert.equal(getSpendingTotal([{ amount: 0.1 }, { amount: 0.2 }]), 0.3);
  });
});
