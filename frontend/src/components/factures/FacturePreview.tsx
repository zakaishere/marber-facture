import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FacturePrintModel } from '@/models/facturePrintModel';
import { numberToFrenchWords } from '@/utils/numberToWords';
import { buildInvoiceRows, paginateInvoiceRows, type InvoicePrintRow } from '@/utils/invoiceLayout';
import { PurchaseDocumentPreview } from './PurchaseDocumentPreview';
import './FacturePreview.css';

const number = (value: number | undefined, decimals = 2) => Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** The invoice and purchase layouts deliberately share the saved print model, not their styles. */
export const FacturePreview = forwardRef<HTMLDivElement, { data: FacturePrintModel; quantitiesOnly?: boolean }>(({ data, quantitiesOnly = false }, ref) =>
  data.invoice.title ? <PurchaseDocumentPreview ref={ref} data={data} /> : <ClientInvoicePreview ref={ref} data={data} quantitiesOnly={quantitiesOnly} />,
);
FacturePreview.displayName = 'FacturePreview';

const ClientInvoicePreview = forwardRef<HTMLDivElement, { data: FacturePrintModel; quantitiesOnly: boolean }>(({ data, quantitiesOnly }, ref) => {
  const { company, client, invoice } = data;
  const rows = useMemo(() => buildInvoiceRows(data.items), [data.items]);
  const title = quantitiesOnly ? 'BON DE LIVRAISON' : 'FACTURE';
  const printNumber = quantitiesOnly ? `BL-${invoice.number}` : invoice.number;
  const totalSurface = data.items.reduce((sum, item) => sum + (item.total_surface || 0), 0);
  const measurement = useRef<HTMLDivElement>(null);
  const [pageSizes, setPageSizes] = useState<number[]>([]);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const root = measurement.current;
    if (!root) return;
    setReady(false);
    const measure = () => {
      const sheets = root.querySelectorAll<HTMLElement>('.fp-page');
      const sheet = sheets[0];
      if (!sheet?.clientHeight) return;
      const scale = sheet.getBoundingClientRect().height / sheet.offsetHeight || 1;
      const height = (selector: string, target = sheet) => {
        const element = target.querySelector<HTMLElement>(selector);
        if (!element) return 0;
        const style = getComputedStyle(element);
        return element.getBoundingClientRect().height / scale + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
      };
      const style = getComputedStyle(sheet);
      const available = (target: HTMLElement) => target.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        - ['.fp-header', '.fp-title', '.fp-client', '.fp-object', '.fp-footer', 'thead'].reduce((sum, selector) => sum + height(selector, target), 0) - 12;
      const heights = Array.from(sheet.querySelectorAll<HTMLElement>('tr[data-invoice-row]')).map(row => row.getBoundingClientRect().height / scale);
      const capacity = (target: HTMLElement) => [available(target) - height('.fp-continuation-reserve', target), available(target) - height('tfoot', target) - height('.fp-amount-words', target)];
      const [normal, final] = capacity(sheet);
      const [continuedNormal, continuedFinal] = capacity(sheets[1]);
      const sizes = paginateInvoiceRows(rows, heights, normal, final, continuedNormal, continuedFinal);
      setPageSizes(previous => previous.join(',') === sizes.join(',') ? previous : sizes);
      setReady(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    root.querySelectorAll('.fp-header, .fp-title, .fp-client, .fp-table, .fp-footer, .fp-amount-words').forEach(element => observer.observe(element));
    let disposed = false;
    void document.fonts.ready.then(() => { if (!disposed) measure(); });
    return () => { disposed = true; observer.disconnect(); };
  }, [rows, company, client, invoice, quantitiesOnly]);

  let offset = 0;
  const pages = (pageSizes.length ? pageSizes : [rows.length]).map(size => {
    const page = rows.slice(offset, offset + size); offset += size; return page;
  });
  const companyName = company.name?.trim() || 'ARABIC STONE';
  const isStone = companyName.replace(/\s/g, '').toUpperCase() === 'ARABICSTONE';
  const phone = company.phone_mobile?.trim() || company.phone_fix?.trim();
  const legal = [['ID', company.if], ['Patente', company.patente], ['RC', company.rc], ['ICE', company.ice]].filter(([, value]) => value?.trim());

  function renderRow(row: InvoicePrintRow, index: number) {
    if (row.type === 'subtotal') return <tr key={index} data-invoice-row className="fp-subtotal"><td>Sous-total</td><td className="fp-center">m²</td><td className="fp-number">{number(row.surface, 4)}</td>{!quantitiesOnly && <><td /><td className="fp-number">{number(row.amount)}</td></>}</tr>;
    const item = row.item;
    return <tr key={index} data-invoice-row className="fp-item">
      <td className="fp-description"><div><span aria-hidden="true">-</span> {item.designation}</div></td>
      <td className="fp-center">m²</td><td className="fp-number">{number(item.total_surface, 4)}</td>{!quantitiesOnly && <><td className="fp-number">{number(item.unit_price_ttc)}</td><td className="fp-number">{number(item.line_total_ttc)}</td></>}
    </tr>;
  }

  function renderPage(pageRows: InvoicePrintRow[], index: number, count: number, measuring = false) {
    const last = index === count - 1;
    // Match the reference's open table on short invoices; never reserve filler on a full page.
    const fillerMm = last && pageRows.length <= 3 ? Math.max(0, 31 - Math.max(0, pageRows.length - 1) * 11) : 0;
    return <section key={index} className={`fp-page${index > 0 ? ' fp-page-continuation' : ''}`} aria-label={`${title} ${printNumber}, page ${index + 1} sur ${count}`}>
      <header className="fp-header"><div className="fp-brand"><span className="fp-brand-square" role="img" aria-label="Emblème en marbre Arabic Stone" /><div className="fp-brand-type"><div className={`fp-brand-name${isStone ? '' : ' fp-brand-custom'}`}>{isStone ? <>ARABIC<br />STONE</> : companyName}</div><div className="fp-brand-rule" /><div className="fp-brand-subtitle">{company.activity || 'MARBRE & PIERRE NATURELLE'}</div></div></div><div className="fp-date">Le : {invoice.date.slice(0, 10).split('-').reverse().join('/')}</div></header>
      <h1 className="fp-title">{title} N° : {printNumber}{index > 0 && <small>Suite ({index + 1}/{count})</small>}</h1>
      {index === 0 && <><section className="fp-client"><div className="fp-client-row"><span className="fp-client-label">CLIENT :</span><strong>{client.name}</strong></div><div className="fp-client-details">{client.ice && <p><b>ICE</b> : {client.ice}</p>}</div></section>
      <div className="fp-object"><strong>OBJET :</strong> {quantitiesOnly ? 'Livraison de marbre & pierre naturelle' : 'Fourniture de marbre & pierre naturelle'}</div></>}
      <table className="fp-table"><colgroup>{quantitiesOnly ? <><col style={{ width: '72%' }} /><col style={{ width: '8%' }} /><col style={{ width: '20%' }} /></> : <><col style={{ width: '49%' }} /><col style={{ width: '5%' }} /><col style={{ width: '13%' }} /><col style={{ width: '15%' }} /><col style={{ width: '18%' }} /></>}</colgroup><thead><tr><th>Désignation</th><th>U</th><th>Qté (m²)</th>{!quantitiesOnly && <><th>P. U TTC<small>MAD/m²</small></th><th>TOTAL TTC<small>MAD</small></th></>}</tr></thead><tbody>
        {pageRows.map(renderRow)}
        {!measuring && fillerMm > 0 && <tr className="fp-filler" aria-hidden="true" style={{ height: `${fillerMm}mm` }}><td /><td /><td />{!quantitiesOnly && <><td /><td /></>}</tr>}
      </tbody>{last && <tfoot>{quantitiesOnly ? <tr className="fp-total-row"><th colSpan={2}>TOTAL m²</th><td className="fp-number">{number(totalSurface, 4)}</td></tr> : <><tr className="fp-total-row"><th colSpan={4}>TOTAL T.T.C</th><td className="fp-number">{number(invoice.total_ttc)}</td></tr><tr className="fp-vat-row"><td colSpan={5}>Dont T.V.A (20 %) : <strong>{number(invoice.total_tva)} MAD</strong><span>Total HT : {number(invoice.total_ht)} MAD</span></td></tr></>}</tfoot>}</table>
      {last ? (!quantitiesOnly && <div className="fp-amount-words"><strong>Arrêtée la présente facture à la somme de :</strong> {numberToFrenchWords(invoice.total_ttc)} T.T.C</div>) : <p className="fp-continuation">Suite du document à la page suivante.</p>}
      {measuring && <p className="fp-continuation-reserve">Suite du document à la page suivante.</p>}
      <footer className="fp-footer"><p className="fp-footer-contact">{company.address}{company.address && phone ? ' – ' : ''}{phone && <>Tél : {phone}</>}</p><div className="fp-footer-rule" />{legal.length > 0 && <p className="fp-legal">{legal.map(([label, value]) => <span key={label}>{label} : {value}</span>)}</p>}<p className="fp-page-number">Page {index + 1} / {count}</p></footer>
    </section>;
  }

  return <><div ref={ref} className="fp-container" data-pagination-ready={ready ? 'true' : 'false'}>{pages.map((page, index) => renderPage(page, index, pages.length))}</div><div ref={measurement} className="fp-measure" aria-hidden="true">{renderPage(rows, 0, 1, true)}{renderPage(rows, 1, 2, true)}</div></>;
});
ClientInvoicePreview.displayName = 'ClientInvoicePreview';
