import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseTransactionFields, validateSplitParticipants } from './transactionValidation.js';

describe('transaction validation', () => {
  it('accepts positive currency amounts with at most two decimal places', () => {
    assert.equal(parseAmount('0.29'), 0.29);
    assert.equal(parseAmount('1000'), 1000);
    assert.equal(parseAmount('0.001'), null);
    assert.equal(parseAmount('-1'), null);
  });

  it('requires a transfer to move money between distinct wallets', () => {
    assert.equal(
      parseTransactionFields({ transactionType: 'transfer', fromWallet: 'cash', toWallet: 'bank' }).error,
      undefined
    );
    assert.equal(
      parseTransactionFields({ transactionType: 'transfer', fromWallet: 'cash', toWallet: 'cash' }).error,
      'A transfer requires different source and destination wallets'
    );
  });

  it('rejects unsupported payment statuses', () => {
    assert.equal(
      parseTransactionFields({ paymentStatus: 'paid' }).error,
      'Invalid payment status'
    );
  });
});

describe('split participant validation', () => {
  it('validates matching split totals correctly', () => {
    const participants = [
      { personName: 'Rahul', shareAmount: 400 },
      { personName: 'Amit', shareAmount: 400 },
      { personName: 'Prakash (You)', shareAmount: 400, isCurrentUser: true },
    ];
    const res = validateSplitParticipants(participants, 1200);
    assert.equal(res.error, undefined);
    assert.equal(res.participants.length, 3);
    assert.equal(res.totalAllocatedPaise, 120000);
  });

  it('detects under-allocated split total and reports remaining amount', () => {
    const participants = [
      { personName: 'Rahul', shareAmount: 400 },
      { personName: 'Amit', shareAmount: 400 },
    ];
    const res = validateSplitParticipants(participants, 1200);
    assert.equal(res.error, '₹400.00 remaining to allocate.');
  });

  it('detects over-allocated split total and reports excess amount', () => {
    const participants = [
      { personName: 'Rahul', shareAmount: 700 },
      { personName: 'Amit', shareAmount: 600 },
    ];
    const res = validateSplitParticipants(participants, 1200);
    assert.equal(res.error, 'Allocated amount exceeds the expense by ₹100.00.');
  });

  it('rejects duplicate participant names', () => {
    const participants = [
      { personName: 'Rahul', shareAmount: 600 },
      { personName: 'Rahul', shareAmount: 600 },
    ];
    const res = validateSplitParticipants(participants, 1200);
    assert.match(res.error, /Duplicate participant name/);
  });

  it('rejects empty or zero share amount', () => {
    const participants = [
      { personName: 'Rahul', shareAmount: 0 },
      { personName: 'Amit', shareAmount: 1200 },
    ];
    const res = validateSplitParticipants(participants, 1200);
    assert.match(res.error, /must have a valid positive share amount/);
  });
});
