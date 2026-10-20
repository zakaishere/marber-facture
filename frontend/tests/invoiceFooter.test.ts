import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceFooterContacts, STONE_LOCATION_URL, STONE_CONTACT_DEFAULTS } from '../src/config/invoiceBranding';
import type { FactureCompany } from '../src/models/facturePrintModel';
const company=(values: Partial<FactureCompany>)=>({name:'ARABIC STONE',activity:'',address:'',phone_fix:'',phone_mobile:'',...values});
test('reference contact details provide the Arabic Stone footer defaults',()=>{
 assert.deepEqual(invoiceFooterContacts(company({})),STONE_CONTACT_DEFAULTS);
 assert.equal(STONE_LOCATION_URL,'https://maps.app.goo.gl/XyUwF8YqNJuASxPQ6');
});
test('saved company details take precedence over reference numbers',()=>{
 assert.deepEqual(invoiceFooterContacts(company({address:'Adresse conservée',phone_whatsapp:'WA',phone_fix:'FIXE',phone_mobile:'MOBILE'})),{address:'Adresse conservée',whatsapp:'WA',fixed:'FIXE',mobile:'MOBILE'});
});
test('another company does not inherit Arabic Stone contact values',()=>{
 assert.deepEqual(invoiceFooterContacts(company({name:'Other company'})),{address:'',whatsapp:'',fixed:'',mobile:''});
});
