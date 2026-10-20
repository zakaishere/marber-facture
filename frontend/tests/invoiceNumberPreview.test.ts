import assert from 'node:assert/strict';
import test from 'node:test';
import { loadInvoiceNumberPreview, sameInvoiceMonth } from '../src/utils/invoiceNumberPreview';
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('rapid date changes ignore older responses even when the transport does not cancel them', async () => {
  const older = deferred<string>(), latest = deferred<string>();
  const oldController = new AbortController(), latestController = new AbortController();
  let shown = '', errors = 0;
  const first = loadInvoiceNumberPreview(() => older.promise, oldController.signal, code => { shown = code; }, () => { errors++; });
  oldController.abort();
  const second = loadInvoiceNumberPreview(() => latest.promise, latestController.signal, code => { shown = code; }, () => { errors++; });
  latest.resolve('01-11-2026'); await second; older.resolve('01-10-2026'); await first;
  assert.equal(shown, '01-11-2026'); assert.equal(errors, 0);
});
test('stale failures and unmounted responses cannot change the current preview', async () => {
  const old = deferred<string>(), controller = new AbortController();
  let updates = 0;
  const pending = loadInvoiceNumberPreview(() => old.promise, controller.signal, () => { updates++; }, () => { updates++; });
  controller.abort(); old.reject(new Error('old request')); await pending; assert.equal(updates, 0);
  const done = new AbortController(); done.abort();
  await loadInvoiceNumberPreview(async () => '01-10-2026', done.signal, () => { updates++; }, () => { updates++; });
  assert.equal(updates, 0);
});
test('an active error is surfaced while day-only changes preserve the invoice month', async () => {
  let failed = false;
  await loadInvoiceNumberPreview(async () => { throw new Error('offline'); }, new AbortController().signal, () => assert.fail('unexpected code'), () => { failed = true; });
  assert.equal(failed, true);
  assert.equal(sameInvoiceMonth('2026-10-01', '2026-10-31'), true);
  assert.equal(sameInvoiceMonth('2026-10-01', '2026-11-01'), false);
  assert.equal(sameInvoiceMonth('2026-10-01', '2027-10-01'), false);
  assert.equal(sameInvoiceMonth('', '2026-10-01'), false);
});
