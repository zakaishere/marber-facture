import { dimensionInCm } from '@/utils/dimensions';
import { forwardRef, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FacturePrintModel, FactureItem } from '@/models/facturePrintModel';
import { numberToFrenchWords } from '@/utils/numberToWords';
import StoneBrand from '@/components/StoneBrand';
import './FacturePreview.css';

type PrintRow = { type: 'item'; item: FactureItem } | { type: 'subtotal'; pieces: number; surface: number; amount: number };
const num = (n: number | undefined, decimals = 2) => Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const dimension = (n: number | undefined) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 3 });
export const FacturePreview = forwardRef<HTMLDivElement, { data: FacturePrintModel }>(({ data }, ref) => {
  const { company, invoice, client, items } = data;
  const rows = useMemo(() => {
    const rows: PrintRow[] = []; let pieces = 0, surface = 0, cents = 0;
    for (const item of items) {
      rows.push({ type: 'item', item }); pieces += item.quantity; surface += item.total_surface || 0; cents += Math.round(item.line_total_ttc * 100);
      if (item.subtotal_after) { rows.push({ type: 'subtotal', pieces, surface, amount: cents / 100 }); pieces = 0; surface = 0; cents = 0; }
    }
    return rows;
  }, [items]);
  const measurement = useRef<HTMLDivElement>(null);
  const [pageSizes, setPageSizes] = useState<number[]>([]);
  useLayoutEffect(() => {
    const root = measurement.current;
    if (!root) return;
    const measure = () => {
      const sheet = root.querySelector<HTMLElement>('.fp-page');
      if (!sheet || !sheet.clientHeight) return;
      // A phone preview may scale its ancestor. Measure pagination in unscaled A4 pixels.
      const renderScale = sheet.getBoundingClientRect().height / sheet.offsetHeight || 1;
      const height = (selector: string) => {
        const element = sheet.querySelector<HTMLElement>(selector)!;
        const style = getComputedStyle(element);
        return element.getBoundingClientRect().height / renderScale + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
      };
      const style = getComputedStyle(sheet);
      const available = sheet.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)
        - ['.fp-header', '.fp-parties', '.fp-object', '.fp-footer', 'thead'].reduce((sum, selector) => sum + height(selector), 0) - 4;
      const finalCapacity = available - height('.fp-amount-words') - height('.fp-summary') - height('.fp-grand');
      const normalCapacity = available - 32;
      const rowElements = Array.from(sheet.querySelectorAll('tbody tr:not(.fp-grand)'));
      const groups: { count: number; height: number }[] = [];
      rows.forEach((row, index) => {
        const rowHeight = rowElements[index].getBoundingClientRect().height / renderScale;
        if (row.type === 'subtotal' && groups.length) {
          groups[groups.length - 1].count++;
          groups[groups.length - 1].height += rowHeight;
        } else groups.push({ count: 1, height: rowHeight });
      });
      const sizes: number[] = [];
      let cursor = 0;
      let remaining = groups.reduce((sum, group) => sum + group.height, 0);
      while (cursor < groups.length) {
        if (remaining <= finalCapacity) {
          sizes.push(groups.slice(cursor).reduce((sum, group) => sum + group.count, 0));
          cursor = groups.length;
        } else {
          let used = 0, count = 0;
          // Fill intermediate pages; keep the last group beside the totals when it fits.
          while (cursor < groups.length && (count === 0 || (used + groups[cursor].height <= normalCapacity && cursor < groups.length - 1))) {
            const group = groups[cursor++];
            used += group.height; remaining -= group.height; count += group.count;
          }
          sizes.push(count);
          if (cursor === groups.length) sizes.push(0);
        }
      }
      if (!sizes.length) sizes.push(0);
      setPageSizes(previous => previous.join(',') === sizes.join(',') ? previous : sizes);
    };
    measure();
    const observer = new ResizeObserver(measure);
    root.querySelectorAll('.fp-header, .fp-parties, .fp-table, .fp-amount-words, .fp-summary, .fp-footer').forEach(element => observer.observe(element));
    let disposed = false;
    void document.fonts.ready.then(() => { if (!disposed) measure(); });
    return () => { disposed = true; observer.disconnect(); };
  }, [rows, company, client, invoice]);
  let offset = 0;
  const pages = (pageSizes.length ? pageSizes : [rows.length]).map(size => { const page = rows.slice(offset, offset + size); offset += size; return page; });
  const totalPcs = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalSurface = items.reduce((sum, item) => sum + (item.total_surface || 0), 0);
  const renderPage = (page: PrintRow[], index: number, pageCount: number) => <section key={index} className="fp-page">
    <header className="fp-header"><StoneBrand name={company.name || 'ARABIC STONE'} squareOnly /><div className="fp-document-title"><span>MARBRE & PIERRE NATURELLE</span><h1>{invoice.title || 'FACTURE'} <small>N° {invoice.number}</small></h1></div><div className="fp-date"><span>Date d'émission</span><strong>{invoice.date.split('-').reverse().join('/')}</strong><p>{company.activity}</p></div></header>
    <div className="fp-parties"><div className="fp-issuer"><span>Émis par</span><strong>{company.name || 'ARABIC STONE'}</strong><p>{company.address}</p><p>{[company.phone_fix, company.phone_mobile].filter(Boolean).join(' · ')}</p><p>{company.email}</p></div><div className="fp-contact"><span>{invoice.title ? 'Fournisseur' : 'Client'}</span><strong>{client.name}</strong><p>{client.city}</p>{client.ice && <p className="fp-ice">ICE : {client.ice}</p>}</div></div>
    <div className="fp-object"><b>Objet :</b> Fourniture de marbre & pierre naturelle <span>Devise : MAD · TVA : 20 %</span></div>
    <table className="fp-table"><colgroup><col style={{ width: '28%' }} /><col style={{ width: '10%' }} /><col style={{ width: '10%' }} /><col style={{ width: '6%' }} /><col style={{ width: '14%' }} /><col style={{ width: '15%' }} /><col style={{ width: '17%' }} /></colgroup><thead><tr><th>Article</th><th>Longueur<br />cm</th><th>Largeur<br />cm</th><th>PCS</th><th>m²</th><th>PU TTC<br />MAD/m²</th><th>Montant TTC<br />MAD</th></tr></thead><tbody>
    {page.map((row, i) => row.type === 'subtotal' ? <tr key={i} className="fp-subtotal"><td colSpan={3}>Sous-total</td><td>{row.pieces}</td><td>{num(row.surface, 4)}</td><td></td><td>{num(row.amount)}</td></tr> : <tr key={i}><td>{row.item.designation}</td><td>{dimension(dimensionInCm(row.item.length, row.item.dimension_unit))}</td><td>{dimension(dimensionInCm(row.item.width, row.item.dimension_unit))}</td><td>{row.item.quantity}</td><td>{num(row.item.total_surface, 4)}</td><td>{num(row.item.unit_price_ttc)}</td><td>{num(row.item.line_total_ttc)}</td></tr>)}
    {index === pageCount - 1 && <tr className="fp-grand"><td colSpan={3}>TOTAL DOCUMENT</td><td>{totalPcs}</td><td>{num(totalSurface, 4)}</td><td></td><td>{num(invoice.total_ttc)}</td></tr>}
    </tbody></table>
    {index === pageCount - 1 ? <><div className="fp-amount-words"><p className="fp-words"><span>{invoice.title ? 'Arrêté le présent document à la somme de' : 'Arrêtée la présente facture à la somme de'}</span>{numberToFrenchWords(invoice.total_ttc)}</p></div><div className="fp-summary"><dl><div><dt>Total HT</dt><dd>{num(invoice.total_ht)} MAD</dd></div><div><dt>Dont TVA (20 %)</dt><dd>{num(invoice.total_tva)} MAD</dd></div><div className="fp-total"><dt>Total TTC</dt><dd>{num(invoice.total_ttc)} MAD</dd></div><div><dt>Montant payé</dt><dd>{num(invoice.paid_amount)} MAD</dd></div><div className="fp-due"><dt>Reste à payer</dt><dd>{num(invoice.amount_to_pay)} MAD</dd></div></dl></div></> : <p className="fp-continuation">Suite du document à la page suivante.</p>}
    <footer className="fp-footer"><div className="fp-footer-details">{company.address && <p>{company.address}{company.phone_fix || company.phone_mobile ? ` · Tél. : ${[company.phone_fix, company.phone_mobile].filter(Boolean).join(' / ')}` : ''}</p>}<div>{[['RC', company.rc], ['IF', company.if], ['ICE', company.ice], ['Patente', company.patente], ['CNSS', company.cnss]].filter(([, value]) => value).map(([label, value]) => <span key={label}>{label} : {value}</span>)}</div></div><p className="fp-page-number">{index + 1} / {pageCount}</p></footer>
  </section>;
  return <><div ref={ref} className="fp-container">{pages.map((page, index) => renderPage(page, index, pages.length))}</div><div ref={measurement} className="fp-measure" aria-hidden="true">{renderPage(rows, 0, 1)}</div></>;
});
FacturePreview.displayName = 'FacturePreview';

