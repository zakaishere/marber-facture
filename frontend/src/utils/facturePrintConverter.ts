import type { Facture, FactureLine } from '@/api/factures';
import type { FacturePrintModel, FactureCompany } from '@/models/facturePrintModel';
import type { User } from '@/api/auth';
import { numberToFrenchWords } from '@/utils/numberToWords';

type PrintableFacture = Pick<Facture, 'company' | 'date' | 'code' | 'totalHt' | 'totalTva' | 'totalTtc' | 'paidAmount' | 'remainingAmount' | 'client'> & { paymentMethod?: string | null; items?: Partial<FactureLine>[]; printCompany?: Partial<FactureCompany> };
export function convertFactureToPrintModel(facture: PrintableFacture, user: User | null = null): FacturePrintModel {
  const company = facture.printCompany || facture.company || user?.company || {};
  const companyData: FactureCompany = { name: '', activity: '', address: '', phone_fix: '', phone_mobile: '', ...company };
  return {
    company: companyData,
    invoice: {
      date: facture.date, number: facture.code, payment_mode: facture.paymentMethod || '',
      total_ht: Number(facture.totalHt), total_tva: Number(facture.totalTva), total_ttc: Number(facture.totalTtc),
      paid_amount: Number(facture.paidAmount || 0), amount_to_pay: Number(facture.remainingAmount ?? facture.totalTtc),
      amount_in_words: numberToFrenchWords(Number(facture.totalTtc)),
    },
    client: { name: facture.client?.name || '', city: facture.client?.address || '', ice: facture.client?.ice || '', phone: facture.client?.phone || '' },
    currency: 'MAD',
    items: (facture.items || []).map(item => ({
      designation: item.product?.name || '', quantity: Number(item.quantity), length: Number(item.length), width: Number(item.width),
      dimension_unit: item.dimensionUnit, total_surface: Number(item.totalSurface || 0), subtotal_after: Boolean(item.subtotalAfter),
      unit_price_ttc: Number(item.unitPriceTtc), line_total_ttc: Number(item.lineTotalTtc), tva_rate_percent: Number(item.tvaRate) * 100,
    })),
  };
}
