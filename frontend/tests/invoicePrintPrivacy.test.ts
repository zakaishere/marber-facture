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


test('saved client contact and company WhatsApp are included without replacing snapshot details', () => {
  const invoice = {company:{name:'ARABIC STONE',activity:'Marbre',address:'Adresse sauvegardée',phone_fix:'0539000000',phone_mobile:'0661000000',phone_whatsapp:'0600630043'},date:'2026-10-20',code:'01-10-2026',totalHt:100,totalTva:20,totalTtc:120,client:{name:'Client enregistré',address:'Adresse client',phone:'0666665521',ice:'000000000000001'},items:[]};
  const print=convertFactureToPrintModel(invoice);
  assert.equal(print.client.phone,'0666665521');assert.equal(print.client.city,'Adresse client');assert.equal(print.client.ice,'000000000000001');
  assert.equal(print.company.phone_whatsapp,'0600630043');assert.equal(print.company.address,'Adresse sauvegardée');
});
