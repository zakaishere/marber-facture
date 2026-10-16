import assert from 'node:assert/strict';
import test from 'node:test';
import { convertFactureToPrintModel } from '../src/utils/facturePrintConverter';
test('internal notes never enter the invoice print/export model', () => {
  const invoice = {company:undefined,date:'2026-10-16',code:'TEST',totalHt:100,totalTva:20,totalTtc:120,paidAmount:0,remainingAmount:120,client:{name:'Client TEST'},items:[],notes:'NOTE_INTERNE_NE_PAS_IMPRIMER'};
  const print = convertFactureToPrintModel(invoice as Parameters<typeof convertFactureToPrintModel>[0]);
  assert.equal(JSON.stringify(print).includes(invoice.notes),false);
  assert.equal('notes' in print,false);
  assert.equal(print.invoice.total_tva,20);
});
