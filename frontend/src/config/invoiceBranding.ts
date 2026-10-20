import type { FactureCompany } from '../models/facturePrintModel';

// Details supplied in the reference document. Saved company values take precedence.
// If the location changes, regenerate the bundled QR image to match this URL.
export const STONE_LOCATION_URL = 'https://maps.app.goo.gl/XyUwF8YqNJuASxPQ6';
export const STONE_LOCATION_QR = '/images/arabic-stone-location-qr.png';
export const STONE_CONTACT_DEFAULTS = {
  whatsapp: '06 00 63 00 43', fixed: '06 30 17 41 07', mobile: '06 61 75 23 37', address: 'Arabic Stone, Tanger, Maroc',
};
export function invoiceFooterContacts(company: FactureCompany) {
  const stone = !company.name || company.name.replace(/\s/g, '').toUpperCase() === 'ARABICSTONE';
  const value = (saved: string | undefined, fallback: string) => saved?.trim() || (stone ? fallback : '');
  return {
    whatsapp: value(company.phone_whatsapp, STONE_CONTACT_DEFAULTS.whatsapp),
    fixed: value(company.phone_fix, STONE_CONTACT_DEFAULTS.fixed),
    mobile: value(company.phone_mobile, STONE_CONTACT_DEFAULTS.mobile),
    address: value(company.address, STONE_CONTACT_DEFAULTS.address),
  };
}
