/**
 * TVA calculation utilities matching the Excel model
 */

export const calculateTvaRate = (tvaPercent: number): number => {
  return tvaPercent / 100;
};

export const calculateUnitPriceHt = (unitPriceTtc: number, tvaRate: number): number => {
  return unitPriceTtc / (1 + tvaRate);
};

export const calculateLineTotals = (
  quantity: number,
  unitPriceTtc: number,
  tvaRate: number
) => {
  const unitPriceHt = calculateUnitPriceHt(unitPriceTtc, tvaRate);
  const lineTotalTtc = quantity * unitPriceTtc;
  const lineTotalHt = quantity * unitPriceHt;
  const lineTotalTva = lineTotalTtc - lineTotalHt;

  return {
    lineTotalHt: Number(lineTotalHt.toFixed(2)),
    lineTotalTva: Number(lineTotalTva.toFixed(2)),
    lineTotalTtc: Number(lineTotalTtc.toFixed(2)),
  };
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'MAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
};

export const formatPercent = (rate: number): string => {
  return `${(rate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 3 })}%`;
};
