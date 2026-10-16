import React, { forwardRef } from 'react';

export type BonItem = {
  qty: number | string;
  description: string;
  unitPrice: number | string;
  total?: number | string;
};

export type BonTotals = {
  total?: number | string;
  paid?: number | string;
  remaining?: number | string;
};

function asNumber(x: number | string | undefined): number | undefined {
  if (x === undefined) return undefined;
  if (typeof x === 'number') return x;
  const n = Number(String(x).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function computeItemsSafe(items?: BonItem[] | null): BonItem[] {
  const safeItems = Array.isArray(items) ? items : [];
  return safeItems.map((it) => {
    const qtyN = asNumber(it.qty);
    const upN = asNumber(it.unitPrice);
    const totN = asNumber(it.total);
    const autoTotal =
      totN !== undefined ? totN : qtyN !== undefined && upN !== undefined ? qtyN * upN : undefined;
    return { ...it, total: it.total ?? (autoTotal !== undefined ? autoTotal.toFixed(2) : it.total) };
  });
}

function computeEffectiveTotals(items: BonItem[], totals?: BonTotals): BonTotals {
  const totalN = asNumber(totals?.total);
  const paidN = asNumber(totals?.paid);
  const remainingN = asNumber(totals?.remaining);
  const autoTotal =
    totalN !== undefined ? totalN : (items || []).reduce((a, it) => a + (asNumber(it.total) ?? 0), 0);
  const autoRemaining =
    remainingN !== undefined ? remainingN : paidN !== undefined ? (autoTotal ?? 0) - paidN : undefined;
  return {
    total: totals?.total ?? (Number.isFinite(autoTotal) ? autoTotal.toFixed(2) : undefined),
    paid: totals?.paid,
    remaining: totals?.remaining ?? (autoRemaining !== undefined ? autoRemaining.toFixed(2) : undefined),
  };
}

const formatMaybe = (v: number | string | undefined) => (v === undefined ? '' : String(v));

interface Party {
  name: string;
  phone?: string;
  phone1?: string;
  address?: string;
}

interface ProductLine {
  uid: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface BonPreviewProps {
  bonTypeLabel: string;
  id?: string;
  company: Party;
  party: Party | undefined;
  partyLabel: string;
  productLines: ProductLine[];
  grandTotal: number;
  amountPaid: number;
  remainingAmount: number;
}

const ROWS_PER_PAGE = 40; // tune for your A5 layout

export const BonPreview = forwardRef<HTMLDivElement, BonPreviewProps>(
  (
    { bonTypeLabel, id, company, party, partyLabel, productLines, grandTotal, amountPaid, remainingAmount },
    ref
  ) => {
    const items: BonItem[] = productLines.map((line) => ({
      qty: line.quantity,
      description: line.name,
      unitPrice: line.unitPrice,
    }));
    const computedItems = computeItemsSafe(items);
    const effectiveTotals = computeEffectiveTotals(computedItems, {
      total: grandTotal,
      paid: amountPaid,
      remaining: remainingAmount,
    });

    // Split rows into fixed-size pages
    const pages: BonItem[][] = [];
    for (let i = 0; i < computedItems.length; i += ROWS_PER_PAGE) {
      pages.push(computedItems.slice(i, i + ROWS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]); // always show at least one page

    return (
      <div ref={ref} id="bon-print-root">
        <section dir="rtl" lang="ar" className="bon-wrap">
          <style>{`
            /* --------- A5 canvas (portrait) --------- */
            @page { size: A5; margin: 0; }

            @media screen and (min-width: 1024px) {
              .bon-wrap { transform: scale(0.95); transform-origin: top center; }
              .bon { margin: 8mm auto; box-shadow: 0 2px 8px rgba(0,0,0,.1); }
              body { background:#f5f5f5; }
            }
            @media screen and (max-width: 1023px) {
              .bon-wrap { transform: scale(0.81); transform-origin: top center; }
              .bon { 
                margin: 0 auto; 
                box-shadow: none;
                width: 148mm;
                min-width: 148mm;
              }
            }
            @media print {
              html, body, #bon-print-root, .bon-wrap, .bon { background:#fff !important; }
              .bon-wrap { transform:none !important; }
              .bon {
                margin:0 !important;
                box-shadow:none !important;
                width:148mm !important; 
                height:210mm !important;    /* fixed page height for reliable pagination */
                page-break-inside: avoid;   /* never split a page container */
                break-inside: avoid-page;
              }
              /* Start each subsequent page on a new sheet (more reliable than break-after) */
              .bon:not(:first-child) { break-before: page; page-break-before: always; }

              /* Replace screen text with true print counters */
              // .page-num { color: transparent; position: relative; }
              // .page-num::after { content: counter(page) " / " counter(pages); color: #666; }
            }

            :root{
              --ink:#111; --muted:#666; --line:#d7d7d7; --line-strong:#333; --th:#f7f7f7; --bg:#fff;
            }

            .bon-wrap { font-family:'Noto Naskh Arabic', Tahoma, Arial, sans-serif; }
            .bon {
              width:148mm; 
              min-height:210mm; 
              padding:8mm;
              box-sizing:border-box; background:var(--bg); color:var(--ink);
              display:flex; flex-direction:column;
            }
            .bon * { -webkit-print-color-adjust:exact; print-color-adjust:exact; font-variant-numeric:tabular-nums; }

            /* ---------- Header (first page only) ---------- */
            .header { text-align:center; line-height:1.35; border-bottom:.28mm solid var(--line-strong); padding-bottom:2mm; margin-bottom:2.5mm; }
            .company { font-weight:800; font-size:14pt; letter-spacing:.2px; }
            .address { color:#444; font-size:8.8pt; }

            /* ---------- Belt row (first page only) ---------- */
            .belt {
              display:grid; grid-template-columns: 1fr 1fr; gap:4mm; align-items:center;
              font-size:8.6pt; margin:2.5mm 0 2.5mm;
            }
            .belt .left  { text-align:left; color:#222; }
            .belt .right { text-align:right; font-weight:800; }

            /* Party (first page only) */
            .party-block { text-align:center; margin: 0 0 3mm; }
            .party-block .name { font-size:9pt; font-weight:800; }
            .party-block .phone { font-size:8.2pt; color:#222; margin-top:1mm; }

            .rule { height:0; border-top:.28mm solid var(--line-strong); margin:2mm 0 3mm; }

            /* ---------- Table ---------- */
            table { width:100%; border-collapse:collapse; table-layout:fixed; margin-bottom:3mm; }
            thead th { background:var(--th); font-weight:700; }
            th, td { border:1px solid var(--line); padding:0.3mm 1.1mm 0mm; text-align:center; font-size:7.9pt; }
            /* Never split a row across a page (extra safety even though we paginate by rows) */
            tr { page-break-inside: avoid; break-inside: avoid; }

            .bon col.qty{ width:14mm; }
            .bon col.unit{ width:20mm; }
            .bon col.total{ width:22mm; }
            td.item{ text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            td.num{ white-space:nowrap; }

            /* ---------- Totals (last page only) ---------- */
            .totals { width:44mm; margin-left:auto; border-collapse:collapse; }
            .totals th, .totals td { border:1px solid #cfcfcf; padding:.8mm 1.1mm; font-size:7.5pt; text-align:center; }
            .totals th { background:#fafafa; font-weight:800; }

            /* footer */
            .footer { margin-top:auto; display:flex; justify-content:space-between; align-items:center; font-size:6.6pt; color:var(--muted); }
          `}</style>

          {/* Render one .bon per page */}
          {pages.map((rows, pageIndex) => {
            const isFirst = pageIndex === 0;
            const isLast = pageIndex === pages.length - 1;

            return (
              <div className="bon" key={pageIndex}>
                {isFirst && (
                  <>
                    <header className="header">
                      <div className="company">{company.name}</div>
                      <div className="address">{company.address || ''}</div>
                    </header>

                    <div className="belt">
                      <div className="right">
                        {bonTypeLabel}
                        {id ? ` — ${id}` : ''}
                      </div>
                      <div className="left">
                        {company.phone ? `الهاتف: ${company.phone}` : ''}
                        {company.phone1 ? (
                          <>
                            <br />
                            {company.phone1}
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="party-block">
                      <div className="name">
                        {partyLabel}: {party?.name || '_____________'}
                      </div>
                      {party?.phone && <div className="phone">الهاتف: {party.phone}</div>}
                      {party?.phone1 && <div className="phone">{party.phone1}</div>}
                    </div>

                    <div className="rule" />
                  </>
                )}

                <table>
                  <colgroup>
                    <col className="qty" />
                    <col />
                    <col className="unit" />
                    <col className="total" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>الكمية</th>
                      <th>الوصف</th>
                      <th>ثمن الوحدة</th>
                      <th>المجموع</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((it, idx) => (
                      <tr key={idx}>
                        <td className="num">{formatMaybe(it.qty)}</td>
                        <td
                          className="item"
                          title={typeof it.description === 'string' ? it.description : undefined}
                        >
                          {it.description || 'منتج غير محدد'}
                        </td>
                        <td className="num">{formatMaybe((it.unitPrice as any)?.toLocaleString?.())}</td>
                        <td className="num">{formatMaybe((it.total as any)?.toLocaleString?.())}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {isLast && (
                  <table className="totals">
                    <tbody>
                      <tr>
                        <th>الإجمالي</th>
                        <td className="num">
                          <span dir="ltr">
                            {formatMaybe(
                              ((effectiveTotals.total as any)?.toLocaleString?.() ?? effectiveTotals.total) as any
                            )}{' '}
                            DH
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th>المدفوع</th>
                        <td className="num">
                          <span dir="ltr">
                            {formatMaybe(
                              ((effectiveTotals.paid as any)?.toLocaleString?.() ?? effectiveTotals.paid) as any
                            )}{' '}
                            DH
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <th>الباقي</th>
                        <td className="num">
                          <span dir="ltr">
                            {formatMaybe(
                              ((effectiveTotals.remaining as any)?.toLocaleString?.() ??
                                effectiveTotals.remaining) as any
                            )}{' '}
                            DH
                          </span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                )}

                <div className="footer">
                  <div>{isFirst ? company.address || '' : ''}</div>
                  <div className="page-num">
                    {pageIndex + 1}/{pages.length}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    );
  }
);

BonPreview.displayName = 'BonPreview';

