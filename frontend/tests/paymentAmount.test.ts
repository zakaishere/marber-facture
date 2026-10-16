import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentCents, paymentDecimal, paymentError } from '../src/utils/paymentAmount';

test('large installments and a final cent settle exactly', () => {
  const total = paymentCents('999999999999.99')!;
  const first = paymentCents('500 000 000 000,01')!;
  const second = paymentCents('499999999999.97')!;
  assert.equal(paymentDecimal(total - first - second), '0.01');
  assert.equal(paymentError('0,01', total - first - second), '');
  assert.notEqual(paymentError('0.02', total - first - second), '');
});
test('correcting a payment restores its own allowance without floating point drift', () => {
  const max = paymentCents(0.1)! + paymentCents(0.2)!;
  assert.equal(paymentDecimal(max), '0.30');
  assert.equal(paymentError('0,30', max), '');
  for (const invalid of ['1.001', 'NaN', 'Infinity', '1e10', '-1', '0']) assert.notEqual(paymentError(invalid, max), '');
});
