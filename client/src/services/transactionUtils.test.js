import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWalletBalances,
  getSpendingTotal,
  toPaise,
  validateSplitParticipantsClient,
  calculatePendingReceivablesTotal,
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

describe('client split participant validation', () => {
  it('validates matching split totals correctly', () => {
    const participants = [
      { personName: 'Rahul', shareAmount: 400 },
      { personName: 'Amit', shareAmount: 400 },
      { personName: 'Prakash (You)', shareAmount: 400, isCurrentUser: true },
    ];
    const res = validateSplitParticipantsClient(participants, 1200);
    assert.equal(res.isValid, true);
    assert.equal(res.totalAllocated, 1200);
    assert.equal(res.remaining, 0);
    assert.equal(res.error, '');
  });

  it('reports remaining unallocated balance when under-allocated', () => {
    const participants = [
      { personName: 'Rahul', shareAmount: 400 },
      { personName: 'Amit', shareAmount: 400 },
    ];
    const res = validateSplitParticipantsClient(participants, 1200);
    assert.equal(res.isValid, false);
    assert.equal(res.remaining, 400);
    assert.equal(res.error, '₹400.00 remaining to allocate.');
  });

  it('reports excess when over-allocated', () => {
    const participants = [
      { personName: 'Rahul', shareAmount: 700 },
      { personName: 'Amit', shareAmount: 600 },
    ];
    const res = validateSplitParticipantsClient(participants, 1200);
    assert.equal(res.isValid, false);
    assert.equal(res.remaining, -100);
    assert.equal(res.error, 'Allocated amount exceeds the expense by ₹100.00.');
  });

  it('calculates pending receivables total excluding current user', () => {
    const receivables = [
      { personName: 'Rahul', shareAmount: 400, amountPaidBack: 0, isCurrentUser: false },
      { personName: 'Amit', shareAmount: 400, amountPaidBack: 200, isCurrentUser: false },
      { personName: 'Prakash', shareAmount: 400, amountPaidBack: 0, isCurrentUser: true },
    ];
    const total = calculatePendingReceivablesTotal(receivables);
    // Rahul owes 400, Amit owes 200, Prakash excluded -> 600
    assert.equal(total, 600);
  });
});
