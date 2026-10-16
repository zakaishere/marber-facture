/**
 * Convert a number to French words (for facture amounts)
 * Returns uppercase French text + " DHS"
 * Example: 4795 -> "QUATRE MILLE SEPT CENT QUATRE-VINGT-QUINZE DHS"
 */

const units = [
  '',
  'UN',
  'DEUX',
  'TROIS',
  'QUATRE',
  'CINQ',
  'SIX',
  'SEPT',
  'HUIT',
  'NEUF',
  'DIX',
  'ONZE',
  'DOUZE',
  'TREIZE',
  'QUATORZE',
  'QUINZE',
  'SEIZE',
  'DIX-SEPT',
  'DIX-HUIT',
  'DIX-NEUF',
];

function convertUnder100(num: number): string {
  if (num === 0) return '';
  if (num < 20) return units[num];
  
  const ten = Math.floor(num / 10);
  const unit = num % 10;
  
  // Special cases: 70-79, 90-99
  if (ten === 7) {
    if (unit === 0) return 'SOIXANTE-DIX';
    if (unit === 1) return 'SOIXANTE-ET-ONZE';
    return `SOIXANTE-${units[10 + unit]}`;
  }
  
  if (ten === 9) {
    if (unit === 0) return 'QUATRE-VINGT-DIX';
    return `QUATRE-VINGT-${units[10 + unit]}`;
  }
  
  // 20-69, 80-89
  let tenWord = '';
  if (ten === 2) tenWord = 'VINGT';
  else if (ten === 3) tenWord = 'TRENTE';
  else if (ten === 4) tenWord = 'QUARANTE';
  else if (ten === 5) tenWord = 'CINQUANTE';
  else if (ten === 6) tenWord = 'SOIXANTE';
  else if (ten === 8) tenWord = 'QUATRE-VINGT';
  
  if (unit === 0) {
    return ten === 8 ? `${tenWord}S` : tenWord;
  }
  
  if (unit === 1 && ten !== 8) {
    return `${tenWord}-ET-UN`;
  }
  
  return `${tenWord}-${units[unit]}`;
}

function convertHundreds(num: number): string {
  if (num === 0) return '';
  if (num < 100) return convertUnder100(num);
  
  // 100-999
  const hundred = Math.floor(num / 100);
  const remainder = num % 100;
  
  let result = '';
  if (hundred === 1) {
    result = 'CENT';
  } else {
    result = `${units[hundred]} CENT`;
  }
  
  if (remainder === 0) {
    return hundred > 1 ? `${result}S` : result;
  }
  
  const remainderStr = convertUnder100(remainder);
  
  return `${result}${hundred > 1 && remainder === 0 ? 'S' : ''}-${remainderStr}`;
}

export function numberToFrenchWords(num: number): string {
  if (!Number.isFinite(num) || num < 0) return '';
  const cents = Math.round(num * 100);
  const whole = Math.floor(cents / 100);
  const decimal = cents % 100;
  const groups: string[] = [];
  let remaining = whole;
  for (const [divisor, singular, plural] of [[1_000_000_000, 'MILLIARD', 'MILLIARDS'], [1_000_000, 'MILLION', 'MILLIONS'], [1000, 'MILLE', 'MILLE']] as const) {
    const count = Math.floor(remaining / divisor);
    remaining %= divisor;
    if (count) groups.push(divisor === 1000 && count === 1 ? 'MILLE' : `${convertHundreds(count)} ${count === 1 ? singular : plural}`);
  }
  if (remaining) groups.push(convertHundreds(remaining));
  const words = groups.join(' ') || 'ZÉRO';
  return `${words} DIRHAM${whole > 1 ? 'S' : ''}${decimal ? ` ET ${convertHundreds(decimal)} CENTIME${decimal > 1 ? 'S' : ''}` : ''}`;
}
