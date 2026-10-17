import assert from 'node:assert/strict';
import test from 'node:test';
import { stockGroups, stockTotal } from '../src/utils/stockGroups';
import type { Product } from '../src/api/products';
const product = (patch: Partial<Product>): Product => ({id:'p', name:'Stone', categoryId:'c', category:{id:'c',name:'Marbre'}, quantity:0, dimensionCount:0, stockPieces:0, purchaseStockValue:'0.00', saleStockValue:'0.00', ...patch} as Product);
test('groups by category id and totals stock value rather than unit prices', () => {
  const groups = stockGroups([
    product({id:'a',quantity:15.95,dimensionCount:1,stockPieces:7,lastPurchasePrice:200,salePrice:550,purchaseStockValue:'3190.00',saleStockValue:'8772.50'}),
    product({id:'b',quantity:55.42,dimensionCount:3,stockPieces:24,purchaseStockValue:'11084.00'}),
    product({id:'s',categoryId:'s',category:{id:'s',name:'Service'}}),
  ]);
  assert.equal(groups.length,2);
  assert.equal(groups[0].dimensions,4);assert.equal(groups[0].pieces,31);
  assert.equal(groups[0].surface,71370000n);assert.equal(groups[0].purchase,1427400n);assert.equal(groups[0].sale,877250n);
});
test('filtered input produces filtered totals and includes zero-stock articles', () => {
  const groups=stockGroups([product({id:'empty'})]);
  assert.equal(groups[0].products.length,1);assert.equal(groups[0].surface,0n);assert.deepEqual(stockGroups([]),[]);
});
test('large exact monetary totals and negative balances are retained without floating point sums', () => {
  const group=stockGroups([product({purchaseStockValue:'1999999999998000.01',quantity:0.1}),product({purchaseStockValue:'0.02',quantity:-0.3})])[0];
  assert.equal(group.purchase,199999999999800003n);assert.equal(group.surface,-200000n);
  assert.equal(stockTotal(group.surface,6,' m²'),'−0,2 m²');
  assert.match(stockTotal(group.purchase,2,' MAD'),/8000,03|8[\s\u202f\u00a0]000,03/);
});
