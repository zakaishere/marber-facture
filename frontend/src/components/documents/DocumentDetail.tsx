import ResponsiveInvoicePreview from './ResponsiveInvoicePreview';
import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { ArrowLeft, Download, Pencil, Printer, Trash2 } from 'lucide-react';
import http from '@/api/http';
import type { MarbleDocument, DocumentPayment } from '@/models/document';
import { convertFactureToPrintModel } from '@/utils/facturePrintConverter';
import { FacturePreview } from '@/components/factures/FacturePreview';
import InvoiceNotes from './InvoiceNotes';
import { exportPdf } from '@/utils/exportPdf';
import { formatCurrency } from '@/utils/tva';
import { paymentLabel } from '@/utils/marble';
import { paymentCents, paymentDecimal, paymentError } from '@/utils/paymentAmount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';

export default function DocumentDetail({ purchase = false }: { purchase?: boolean }) {
  const { user } = useAuth(); const restricted = user?.role === 'ROLE_INVOICING';
  const { id } = useParams(); const base = purchase ? '/bon-achat' : '/factures'; const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [doc, setDoc] = useState<MarbleDocument | null>(null); const [payments, setPayments] = useState<DocumentPayment[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null); const [amount, setAmount] = useState(''); const [method, setMethod] = useState(purchase ? 'CASH' : 'ESPECE'); const [date, setDate] = useState(new Date().toLocaleDateString('en-CA')); const [note, setNote] = useState('');
  const preview = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({ contentRef: preview, documentTitle: doc?.code || 'Document' });
  const load = useCallback(async () => {
    try { const [document, history] = await Promise.all([http.get<MarbleDocument>(`${base}/${id}`), restricted ? Promise.resolve({ data: [] as DocumentPayment[] }) : http.get<DocumentPayment[]>(`${base}/${id}/payments`)]); setDoc(document.data); setPayments(history.data); setError(''); }
    catch (e: unknown) { const err = e as { response?: { data?: { message?: string } } }; setError(err.response?.data?.message || 'Chargement impossible.'); }
    finally { setLoading(false); }
  }, [base, id, restricted]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!doc || searchParams.get('print') !== 'true') return;
    const frame = requestAnimationFrame(() => { print(); setSearchParams({}, { replace: true }); });
    return () => cancelAnimationFrame(frame);
  }, [doc, searchParams, setSearchParams, print]);
  function reset() { setEditing(null); setAmount(''); setNote(''); setDate(new Date().toLocaleDateString('en-CA')); }
  async function savePayment(event: React.FormEvent) {
    event.preventDefault(); if (busy || !amount.trim() || amountError) return; setBusy(true);
    try { const payload = { amount: paymentDecimal(paymentCents(amount)!), method, date, note }; if (editing) await http.put(`${base}/${id}/payments/${editing}`, payload); else await http.post(`${base}/${id}/payments`, payload); reset(); await load(); toast({ title: 'Paiement enregistré' }); }
    catch (e: unknown) { const err = e as { response?: { data?: { message?: string } } }; toast({ title: 'Paiement refusé', description: err.response?.data?.message || 'Réessayez.', variant: 'destructive' }); }
    finally { setBusy(false); }
  }
  async function removePayment(paymentId: string) {
    if (!window.confirm('Supprimer ce paiement et recalculer le reste à payer ?')) return;
    setBusy(true); try { await http.delete(`${base}/${id}/payments/${paymentId}`); reset(); await load(); }
    catch (e: unknown) { const err = e as { response?: { data?: { message?: string } } }; toast({ title: 'Suppression impossible', description: err.response?.data?.message, variant: 'destructive' }); } finally { setBusy(false); }
  }
  async function download() { if (!preview.current || !doc) return; setExporting(true); try { await exportPdf(preview.current, `${doc.code.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`); } catch { toast({ title: 'Export PDF impossible', description: 'Vous pouvez utiliser Imprimer puis Enregistrer au format PDF.', variant: 'destructive' }); } finally { setExporting(false); } }
  if (loading) return <LoadingSpinner />;
  if (!doc) return <div role="alert" className="p-8 text-destructive">{error || 'Document introuvable'} <Link to={base}>Retour</Link></div>;
  const total = Number(purchase ? doc.totalAmount : doc.totalTtc);
  const printModel = convertFactureToPrintModel({ ...doc, totalTtc: total, client: purchase ? doc.supplier : doc.client, items: doc.items.map(line => ({ ...line, unitPriceTtc: purchase ? line.unitPrice : line.unitPriceTtc, lineTotalTtc: purchase ? line.lineTotal : line.lineTotalTtc })) });
  if (purchase) printModel.invoice.title = "BON D'ACHAT";
  const maxPaymentCents = (paymentCents(doc.remainingAmount) ?? 0n) + (paymentCents(payments.find(p => p.id === editing)?.amount || 0) ?? 0n);
  const maxPayment = Number(paymentDecimal(maxPaymentCents));
  const amountError = paymentError(amount, maxPaymentCents);
  const enteredCents = paymentCents(amount);
  const balanceAfter = enteredCents !== null && !amountError ? Number(paymentDecimal(maxPaymentCents - enteredCents)) : null;
  return <div className="document-detail p-4 lg:p-8 max-w-[1500px] mx-auto space-y-6">
    <div className="flex flex-wrap justify-between gap-4"><div><Link to={base} className="inline-flex items-center gap-2 text-muted-foreground text-sm mb-3"><ArrowLeft size={16} />Retour aux documents</Link><p className="stone-kicker">{purchase ? 'Achat fournisseur' : 'Facture client'}</p><h1 className="text-3xl font-semibold mt-1">{doc.code}</h1><p className="text-muted-foreground mt-2">{(purchase ? doc.supplier : doc.client)?.name} · {doc.date}</p></div><div className="flex gap-2 flex-wrap items-center">{!restricted && <Button variant="outline" asChild><Link to={`${base}/${id}/edit`}><Pencil size={15} className="mr-2" />Modifier</Link></Button>}<Button variant="outline" onClick={print}><Printer size={15} className="mr-2" />Imprimer</Button><Button onClick={download} disabled={exporting}><Download size={15} className="mr-2" />{exporting ? 'Export…' : 'Télécharger PDF'}</Button></div></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{[['Total HT', doc.totalHt], ['TVA', doc.totalTva], ['Total TTC', total], ['Payé', doc.paidAmount], ['Reste à payer', doc.remainingAmount]].map(([label, value]) => <Card key={String(label)}><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-lg lg:text-xl font-semibold mt-2">{formatCurrency(Number(value))}</p></CardContent></Card>)}</div>
    {!purchase && !restricted && <InvoiceNotes invoiceId={doc.id} notes={doc.notes} onSaved={notes => setDoc(current => current ? { ...current, notes } : current)} />}
    {!restricted && <Card><CardContent className="pt-6 space-y-5"><div className="flex flex-wrap gap-3 justify-between"><div><h2 className="font-semibold text-lg">Versements & historique des paiements</h2><p className="text-sm text-muted-foreground mt-1">Payez en plusieurs fois : chaque versement est conservé avec sa date, son mode et sa note.</p></div><span className={`text-sm px-3 py-1 rounded-full ${Number(doc.remainingAmount) === 0 ? 'bg-success/10 text-green-800' : 'bg-primary/10 text-primary'}`}>{Number(doc.remainingAmount) === 0 ? 'Soldé' : Number(doc.paidAmount) ? 'Partiellement payé' : 'Non payé'}</span></div>
      <p className="text-sm text-muted-foreground">{payments.length} versement{payments.length > 1 ? 's' : ''} enregistré{payments.length > 1 ? 's' : ''} · Total payé : <strong className="text-foreground">{formatCurrency(Number(doc.paidAmount))}</strong> · Reste : <strong className="text-foreground">{formatCurrency(Number(doc.remainingAmount))}</strong></p>
      {payments.length ? <div className="overflow-x-auto"><table className="mobile-record-table w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Date</th><th>Mode</th><th>Note</th><th className="text-right">Montant</th><th></th></tr></thead><tbody>{payments.map(p => <tr key={p.id} className="border-b"><td data-label="Date" className="py-3">{p.date.slice(0, 10)}</td><td data-label="Mode">{paymentLabel(p.method)}</td><td data-label="Note">{p.note}</td><td data-label="Montant" className="text-right font-medium">{formatCurrency(Number(p.amount))}</td><td data-label="Actions" className="text-right whitespace-nowrap"><Button variant="ghost" size="icon" aria-label="Modifier le paiement" disabled={busy} onClick={() => { setEditing(p.id); setAmount(String(p.amount)); setMethod(p.method); setDate(p.date.slice(0, 10)); setNote(p.note || ''); }}><Pencil size={14} /></Button><Button variant="ghost" size="icon" aria-label="Supprimer le paiement" disabled={busy} onClick={() => removePayment(p.id)}><Trash2 size={14} /></Button></td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>}
      {(maxPayment > 0 || editing) && doc.status !== 'CANCELLED' && <form className="payment-form grid gap-4 md:grid-cols-2 xl:grid-cols-5 items-start" onSubmit={savePayment}><div className="space-y-2"><Label htmlFor="pay-amount">{editing ? 'Montant corrigé (MAD)' : 'Montant (MAD)'}</Label><Input id="pay-amount" type="text" inputMode="decimal" maxLength={30} value={amount} required disabled={busy} aria-invalid={Boolean(amountError)} aria-describedby="pay-amount-help" onChange={e => setAmount(e.target.value)} placeholder="Ex. 5 000,00" /><p id="pay-amount-help" className={amountError ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>{amountError || `Maximum : ${formatCurrency(maxPayment)}`}</p><button type="button" className="text-xs text-primary underline" disabled={busy} onClick={() => setAmount(paymentDecimal(maxPaymentCents))}>Régler tout le solde</button></div><div className="space-y-2"><Label htmlFor="pay-date">Date</Label><Input id="pay-date" type="date" required value={date} onChange={e => setDate(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="pay-method">Mode</Label><select id="pay-method" className="h-10 rounded-md border bg-white px-3 w-full text-sm" value={method} onChange={e => setMethod(e.target.value)}>{(purchase ? ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD'] : ['ESPECE', 'VIREMENT', 'CHEQUE', 'LCN']).map(m => <option key={m} value={m}>{paymentLabel(m)}</option>)}</select></div><div className="space-y-2"><Label htmlFor="pay-note">Note</Label><Input id="pay-note" maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></div><div className="flex gap-2 pt-7"><Button disabled={busy || !amount.trim() || Boolean(amountError)}>{busy ? 'Enregistrement…' : editing ? 'Enregistrer la correction' : 'Ajouter le versement'}</Button>{editing && <Button type="button" variant="outline" onClick={reset}>Annuler</Button>}</div></form>}
      {amount.trim() && balanceAfter !== null && <p role="status" className="text-sm text-muted-foreground">Après ce versement, le reste à payer sera de <strong className="text-foreground">{formatCurrency(balanceAfter)}</strong>.</p>}
      {Number(doc.remainingAmount) === 0 && !editing && <p className="text-sm text-green-800">Ce document est entièrement payé. Vous pouvez consulter ou corriger les versements ci-dessus.</p>}
      {purchase && <p className="text-xs text-muted-foreground">Ces règlements sont liés au bon d'achat. Ils ne remplacent pas une facture fournisseur ni une comptabilité.</p>}
    </CardContent></Card>}
    <ResponsiveInvoicePreview><FacturePreview ref={preview} data={printModel} /></ResponsiveInvoicePreview>
  </div>;
}
