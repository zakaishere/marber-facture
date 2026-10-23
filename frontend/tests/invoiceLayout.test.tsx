import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildInvoiceRows, paginateInvoiceRows } from '../src/utils/invoiceLayout';
import { convertFactureToPrintModel } from '../src/utils/facturePrintConverter';
import { FacturePreview } from '../src/components/factures/FacturePreview';
import type { FactureItem, FacturePrintModel } from '../src/models/facturePrintModel';

const line = (overrides: Partial<FactureItem> = {}): FactureItem => ({ designation: 'NOIR GALAXY', length: 200, width: 100, dimension_unit: 'CM', quantity: 4, total_surface: 8, unit_price_ttc: 1625, line_total_ttc: 13000, tva_rate_percent: 20, ...overrides });
const model: FacturePrintModel = { company: { name: 'ARABIC STONE', activity: 'MARBRE & PIERRE NATURELLE', address: 'Adresse dynamique', phone_mobile: '0661752337', phone_fix: '', ice: '002728335000053', if: '50104635' }, client: { name: 'CLIENT EXEMPLE', ice: '003147888000073', city: 'Tanger' }, invoice: { date: '2026-10-22', number: '02-10-2026', payment_mode: '', total_ht: 10833.33, total_tva: 2166.67, total_ttc: 13000, amount_to_pay: 13000 }, currency: 'MAD', items: [line()] };

test('subtotal markers span multiple articles and reset the next group without recalculating saved amounts', () => {
  const rows = buildInvoiceRows([line({ line_total_ttc: 0.1 }), line({ designation: 'CREMA', line_total_ttc: 0.2, subtotal_after: true }), line({ line_total_ttc: 40, subtotal_after: true })]);
  assert.deepEqual(rows[2], { type: 'subtotal', surface: 16, amount: 0.3 });
  assert.deepEqual(rows[4], { type: 'subtotal', surface: 8, amount: 40 });
});
test('measured pagination keeps every row and never orphans a subtotal', () => {
  const rows = buildInvoiceRows(Array.from({ length: 40 }, (_, index) => line({ subtotal_after: index % 5 === 4 })));
  const sizes = paginateInvoiceRows(rows, rows.map((_, index) => index % 3 === 0 ? 43 : 31), 240, 170);
  assert.equal(sizes.reduce((sum, size) => sum + size, 0), rows.length);
  let offset = 0;
  for (const size of sizes) { assert.notEqual(rows[offset]?.type, 'subtotal'); offset += size; }
  assert.ok(sizes.length > 4);
});
test('a full sheet gets a totals page and an empty invoice still renders one page', () => {
  const rows = buildInvoiceRows([line()]);
  assert.deepEqual(paginateInvoiceRows(rows, [200], 200, 120), [1, 0]);
  assert.deepEqual(paginateInvoiceRows([], [], 200, 120), [0]);
});
test('continuation pages use the extra table space and keep the last article beside totals', () => {
  const rows = buildInvoiceRows(Array.from({ length: 9 }, () => line()));
  assert.deepEqual(paginateInvoiceRows(rows, rows.map(() => 50), 100, 50, 250, 200), [2, 5, 2]);
});
test('reference layout prints dynamic company, date, client name, ICE and prices without HTML injection', () => {
  const html = renderToStaticMarkup(<FacturePreview data={{ ...model, client: { ...model.client, name: '<script>client</script>' } }} />);
  for (const text of ['02-10-2026', '22/10/2026', 'Adresse dynamique', '002728335000053', '50104635', 'NOIR GALAXY', 'TOTAL T.T.C', 'Dont T.V.A']) assert.ok(html.includes(text), text);
  assert.ok(html.includes('&lt;script&gt;client&lt;/script&gt;'));
  assert.ok(!html.includes('<script>client'));
  for (const detail of ['Long.', 'larg.', '200 cm', '100 cm', '4 pièces']) assert.ok(!html.includes(detail), detail);
});
test('invoice matches the reference contact fields without QR, client extras or other company contacts', () => {
  const data = { ...model, company: { ...model.company, patente: '57285908', rc: '114113', phone_fix: 'FIXED_PHONE_PRIVATE', phone_whatsapp: 'WHATSAPP_PRIVATE', email: 'EMAIL_PRIVATE@example.test', cnss: 'CNSS_PRIVATE', rib: 'RIB_PRIVATE' }, client: { ...model.client, city: 'CLIENT_ADDRESS_PRIVATE', phone: 'CLIENT_PHONE_PRIVATE' } };
  const html = renderToStaticMarkup(<FacturePreview data={data} />);
  for (const value of ['CLIENT EXEMPLE', '003147888000073', 'Adresse dynamique', 'Tél : ', '0661752337', 'ID : 50104635', 'Patente : 57285908', 'RC : 114113', 'ICE : 002728335000053']) assert.ok(html.includes(value), value);
  for (const value of ['CLIENT_ADDRESS_PRIVATE', 'CLIENT_PHONE_PRIVATE', 'FIXED_PHONE_PRIVATE', 'WHATSAPP_PRIVATE', 'EMAIL_PRIVATE', 'CNSS_PRIVATE', 'RIB_PRIVATE', 'maps.app', 'location-qr', 'Nous trouver', '<img', '<a ']) assert.ok(!html.includes(value), value);
});
test('new company settings replace all print branding fields, including cleared fields, while source snapshots stay unchanged', () => {
  const invoice = { company: model.company, printCompany: { name: 'NOUVELLE SOCIÉTÉ', address: 'Adresse actuelle', phone_mobile: '', ice: '' }, date: '2026-10-22', code: '02-10-2026', totalHt: 100, totalTva: 20, totalTtc: 120, client: { name: 'Client sauvegardé' }, items: [] };
  const print = convertFactureToPrintModel(invoice);
  assert.equal(print.company.name, 'NOUVELLE SOCIÉTÉ');
  assert.equal(print.company.phone_mobile, ''); assert.equal(print.company.ice, '');
  assert.equal(invoice.company.phone_mobile, '0661752337');
  const html = renderToStaticMarkup(<FacturePreview data={print} />);
  assert.ok(html.includes('NOUVELLE SOCIÉTÉ')); assert.ok(!html.includes('50104635'));
});
test('purchase documents retain their marble table and existing numbering', () => {
  const html = renderToStaticMarkup(<FacturePreview data={{ ...model, invoice: { ...model.invoice, title: "BON D'ACHAT", number: 'BA2610001' } }} />);
  assert.ok(html.includes('BA2610001')); assert.ok(html.includes('Longueur')); assert.ok(html.includes('mp-page'));
});

test('delivery note retains articles, m² and subtotal boundaries without rendering any financial information', () => {
  const data = { ...model, items: [line({ subtotal_after: true }), line({ designation: 'CREMA SILVIA', total_surface: 4, subtotal_after: true })] };
  const html = renderToStaticMarkup(<FacturePreview data={data} quantitiesOnly />);
  for (const value of ['BON DE LIVRAISON', 'BL-02-10-2026', 'CLIENT EXEMPLE', '003147888000073', 'NOIR GALAXY', 'CREMA SILVIA', 'Sous-total', 'TOTAL m²', '12,0000']) assert.ok(html.includes(value), value);
  for (const value of ['P. U', 'TTC', 'T.T.C', 'T.V.A', 'TVA', 'Total HT', 'MAD', 'DIRHAMS', 'Montant payé', 'Reste à payer', 'Arrêtée', '13 000,00', '1 625,00']) assert.ok(!html.includes(value), value);
  assert.ok(!html.includes('fp-amount-words')); assert.ok(!html.includes('fp-vat-row'));
  assert.equal(data.items[0].unit_price_ttc, 1625); assert.equal(data.invoice.total_ttc, 13000);
});
