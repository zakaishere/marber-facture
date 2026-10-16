import { lineInCm, dimensionInCm } from '../src/utils/dimensions';
import assert from 'node:assert/strict';
import test from 'node:test';
import { invoiceStock } from '../src/utils/invoiceStock';
import type { MarbleLine } from '../src/models/document';
import { lineAmounts, lineInputError } from '../src/utils/marble';
const line = (quantity = 1, productId = 'a', patch: Partial<MarbleLine> = {}): MarbleLine => ({productId, length: 100, width: 100, dimensionUnit: 'CM', quantity, ...patch});
test('an exact stock match is valid; one extra piece is rejected immediately', () => {
  const products = [{id:'a', quantity:5}];
  assert.equal(invoiceStock([line(5)],products)[0].exceeds,false);
  const result=invoiceStock([line(6)],products)[0];
  assert.equal(result.exceeds,true);assert.equal(result.maxPieces,5);assert.equal(result.available,5);
});
test('repeated articles share stock across subtotal markers and distinct dimensions', () => {
  const result=invoiceStock([line(3,'a',{subtotalAfter:true}),line(2,'a',{length:200}),line(1,'b')],[{id:'a',quantity:5},{id:'b',quantity:1}]);
  assert.equal(result[0].exceeds,false);assert.equal(result[1].available,2);assert.equal(result[1].maxPieces,1);assert.equal(result[1].exceeds,true);assert.equal(result[2].exceeds,false);
});
test('editing restores the original invoice allocation exactly once', () => {
  const result=invoiceStock([line(5),line(3)],[{id:'a',quantity:2}],[line(3),line(2)]);
  assert.equal(result[0].available,7);assert.equal(result[0].exceeds,false);assert.equal(result[1].available,2);assert.equal(result[1].exceeds,true);
});
test('negative historical stock allows the original sale to be corrected, never increased', () => {
  const products=[{id:'a',quantity:-1.6}];
  assert.equal(invoiceStock([line(3)],products,[line(3)])[0].exceeds,false);
  assert.equal(invoiceStock([line(4)],products,[line(3)])[0].exceeds,true);
  assert.equal(invoiceStock([line(1)],products)[0].exceeds,true);
});
test('centimetres and metres preserve exact six-decimal stock boundaries', () => {
  const cm=line(3,'a',{length:323,width:71});
  const metre=line(3,'a',{length:3.23,width:.71,dimensionUnit:'M'});
  for(const value of [cm,metre]){
    assert.equal(invoiceStock([value],[{id:'a',quantity:6.8799}])[0].exceeds,false);
    assert.equal(invoiceStock([value],[{id:'a',quantity:6.879899}])[0].exceeds,true);
  }
});
test('duplicates account for the whole article allocation; deleting rows releases stock', () => {
  assert.equal(invoiceStock([line(3),line(2)],[{id:'a',quantity:7}])[0].canDuplicate,false);
  assert.equal(invoiceStock([line(3)],[{id:'a',quantity:7}])[0].canDuplicate,true);
});
test('missing or unavailable stock cannot be treated as known stock', () => {
  assert.equal(invoiceStock([line()],[])[0].known,false);
  assert.equal(invoiceStock([line()],[])[0].exceeds,true);
  assert.equal(invoiceStock([line()],[{id:'a',quantity:0}])[0].maxPieces,0);
  assert.equal(invoiceStock([line()],[{id:'a',quantity:NaN}])[0].known,false);
});
test('huge price, dimensions and non-finite inputs give specific errors without crashing the preview', () => {
  const purchase = line(1,'a',{unitPrice:9999999999.99});
  assert.equal(lineInputError(purchase,true),null);
  assert.equal(lineAmounts(purchase,true).ttc,9999999999.99);
  for (const value of [10000000000,1e100,Infinity]) {
    assert.match(lineInputError({...purchase,unitPrice:value},true)!,/Prix TTC/);
    assert.equal(lineAmounts({...purchase,unitPrice:value},true).ttc,0);
  }
  assert.match(lineInputError({...purchase,length:100001},true)!,/Longueur/);
  assert.match(lineInputError({...purchase,length:1.2345},true)!,/3 décimales/);
  assert.match(lineInputError({...purchase,unitPrice:120.123},true)!,/2 décimales/);
  assert.match(lineInputError({...purchase,quantity:100001},true)!,/PCS/);
});

test('centimetre-only editing preserves areas and totals of old metre lines', () => {
  const metres = line(16, 'a', { length: 3.23, width: 0.71, dimensionUnit: 'M', unitPriceTtc: 200 });
  const centimetres = lineInCm(metres);
  assert.equal(centimetres.length, 323); assert.equal(centimetres.width, 71); assert.equal(centimetres.dimensionUnit, 'CM');
  assert.deepEqual(lineAmounts(centimetres), lineAmounts(metres));
  assert.equal(lineAmounts(centimetres).totalSurface, 36.6928); assert.equal(lineAmounts(centimetres).ttc, 7338.56);
  assert.equal(dimensionInCm(2.333, 'M'), 233.3);
  assert.equal(lineInCm(centimetres).length, 323);
});
