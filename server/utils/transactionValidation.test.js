import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseTransactionFields } from './transactionValidation.js';

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
