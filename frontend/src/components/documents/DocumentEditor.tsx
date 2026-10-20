import DeclarationConfirmation, { type DeclarationStatus } from './DeclarationConfirmation';
import { lineInCm } from '@/utils/dimensions';
import { useAuth } from '@/contexts/AuthContext';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Save, Trash2, ListPlus, Copy, Ruler, RefreshCw } from 'lucide-react';
import http from '@/api/http';
import { getProducts, type Product } from '@/api/products';
import { getClients } from '@/api/clients';
import { getSuppliers } from '@/api/suppliers';
import type { MarbleDocument, MarbleLine, Party } from '@/models/document';
import { lineAmounts, lineInputError, MARBLE_LIMITS, area } from '@/utils/marble';
import { invoiceStock } from '@/utils/invoiceStock';
import { loadInvoiceNumberPreview, sameInvoiceMonth } from '@/utils/invoiceNumberPreview';
import { formatCurrency } from '@/utils/tva';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import SearchSelect from './SearchSelect';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { AddSupplierDialog } from '@/components/suppliers/AddSupplierDialog';

const selectStyle = 'h-10 w-full rounded-md border border-input bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring';
const localDate = () => new Date().toLocaleDateString('en-CA');
const emptyLine = (): MarbleLine => ({ productId: '', length: 0, width: 0, dimensionUnit: 'CM', quantity: 1, unitPrice: 0, unitPriceTtc: 0, tvaPercent: 20 });

export default function DocumentEditor({ purchase = false }: { purchase?: boolean }) {
  const { user } = useAuth(); const restricted = user?.role === 'ROLE_INVOICING';
  const { id } = useParams(); const navigate = useNavigate(); const { toast } = useToast();
  const base = purchase ? '/bon-achat' : '/factures';
  const [products, setProducts] = useState<Product[]>([]); const [parties, setParties] = useState<Party[]>([]);
  const [items, setItems] = useState<MarbleLine[]>([emptyLine()]);
  const [originalItems, setOriginalItems] = useState<MarbleLine[]>([]);
  const [stockError, setStockError] = useState('');
  const [checkingStock, setCheckingStock] = useState(false);
  const mounted = useRef(true); const stockPending = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const refreshStock = useCallback(async () => {
    if (stockPending.current) return;
    stockPending.current = true; setCheckingStock(true);
    try { const latest = restricted ? (await http.get<{products: Product[]}>('/invoice-options')).data.products : await getProducts({ limit: 10000 }); if (mounted.current) { setProducts(latest); setStockError(''); } }
    catch { if (mounted.current) setStockError('Stock temporairement indisponible. Vous pouvez enregistrer la facture et actualiser le stock plus tard.'); }
    finally { stockPending.current = false; if (mounted.current) setCheckingStock(false); }
  }, [restricted]);
  const [originalNumber, setOriginalNumber] = useState<{ date: string; code: string } | null>(null);
  const [numberLoading, setNumberLoading] = useState(false);
  const [numberError, setNumberError] = useState('');
  const [partyId, setPartyId] = useState(''); const [date, setDate] = useState(localDate()); const [code, setCode] = useState('');
  const [method, setMethod] = useState(purchase ? 'CASH' : ''); const [status, setStatus] = useState('NOT_DECLARED');
  const [pendingDeclaration, setPendingDeclaration] = useState<DeclarationStatus | null>(null);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const [paid, setPaid] = useState(0);
  const [notes, setNotes] = useState('');
  const [addContactOpen, setAddContactOpen] = useState(false);
  const lineInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const key = focusNext.current;
    if (!key) return;
    focusNext.current = null;
    const frame = requestAnimationFrame(() => { const input = lineInputs.current[key]; input?.focus(); input?.select(); });
    return () => cancelAnimationFrame(frame);
  }, [items]);
  useEffect(() => {
    let active = true;
    const options = restricted ? http.get<{products: Product[];clients: Party[]}>('/invoice-options').then(response => response.data) : null;
    Promise.all([options ? options.then(value => value.products) : getProducts({ limit: 10000 }), options ? options.then(value => value.clients) : purchase ? getSuppliers({ limit: 10000 }) : getClients({ limit: 10000 }), id ? http.get<MarbleDocument>(`${base}/${id}`).then(r => r.data) : Promise.resolve(null)])
      .then(([articles, contacts, doc]) => {
        if (!active) return; setProducts(articles); setParties(contacts);
        setOriginalItems(doc?.items || []); setStockError('');
        setNotes(doc?.notes || '');
        setOriginalNumber(doc ? { date: doc.date, code: doc.code } : null);
        if (doc) { setPartyId((purchase ? doc.supplierId : doc.clientId) || ''); setCode(doc.code); setDate(doc.date); setStatus(doc.status); setMethod(doc.paymentMethod || ''); setPaid(Number(doc.paidAmount));
          setItems(doc.items.map(item => ({ ...lineInCm(item), tvaPercent: 20 })));
        }
      }).catch(e => { if (active) setError(e.response?.data?.message || 'Impossible de charger le formulaire.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, purchase, base, restricted]);
  useEffect(() => {
    if (loading || purchase) return;
    const refresh = () => { if (document.visibilityState !== 'hidden') void refreshStock(); };
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [loading, purchase, refreshStock]);

  useEffect(() => {
    if (loading || purchase) return;
    const controller = new AbortController();
    setNumberError('');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { setCode(''); setNumberLoading(false); return; }
    if (originalNumber && sameInvoiceMonth(originalNumber.date, date)) {
      setCode(originalNumber.code); setNumberLoading(false); return;
    }
    setCode(''); setNumberLoading(true);
    void loadInvoiceNumberPreview(
      () => http.get<{code: string}>('/factures/number-preview', { params: { date, ...(id ? { invoiceId: id } : {}) }, signal: controller.signal }).then(response => response.data.code),
      controller.signal,
      proposed => { setCode(proposed); setNumberLoading(false); },
      () => { setNumberError('Aperçu indisponible. Le numéro sera attribué à l’enregistrement.'); setNumberLoading(false); },
    );
    return () => controller.abort();
  }, [loading, purchase, date, id, originalNumber]);

  function changeDate(value: string) {
    setDate(value);
    if (!purchase) {
      setCode(originalNumber && sameInvoiceMonth(originalNumber.date, value) ? originalNumber.code : '');
      setNumberError('');
    }
  }

  const amounts = items.map(line => lineAmounts(line, purchase));
  const lineErrors = items.map((line, index) => lineInputError(line, purchase) || (amounts[index].ttc > MARBLE_LIMITS.total ? 'Montant de ligne : maximum 999 999 999 999,99 MAD TTC. Réduisez le prix, les dimensions ou les PCS.' : null));
  const totalTooHigh = amounts.reduce((sum, value) => sum + Math.round(value.ttc * 100), 0) / 100 > MARBLE_LIMITS.total;
  const lineStock = purchase ? [] : invoiceStock(items, products, originalItems);
  const hasStockIssue = !purchase && (!!stockError || lineStock.some(value => value.exceeds));
  const hasEntryIssue = lineErrors.some(Boolean) || totalTooHigh;

  function change(index: number, patch: Partial<MarbleLine>) { setError(''); setItems(current => current.map((item, i) => i === index ? { ...item, ...patch } : item)); }
  function selectProduct(index: number, productId: string) {
    const product = products.find(p => p.id === productId);
    focusNext.current = `${index}-length`;
    change(index, { productId, product, unitPriceTtc: Number(product?.salePrice || 0), unitPrice: Number(product?.lastPurchasePrice || 0), tvaPercent: 20 });
  }
  function addLine(sameArticle = true) {
    if (hasEntryIssue) return;
    const last = items[items.length - 1]; const line = emptyLine();
    if (sameArticle && last?.productId) { line.productId = last.productId; line.product = last.product; line.unitPrice = last.unitPrice; line.unitPriceTtc = last.unitPriceTtc; line.width = last.width; focusNext.current = `${items.length}-length`; }
    setItems(current => [...current, line]);
  }
  function duplicateLine(index: number) {
    if (hasEntryIssue) return;
    focusNext.current = `${index + 1}-length`;
    setItems(current => current.flatMap((line, i) => i === index ? [{ ...line, subtotalAfter: false }, { ...line, id: undefined, tvaPercent: 20 }] : [line]));
  }
  function advance(event: React.KeyboardEvent<HTMLInputElement>, index: number, key: string) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const order = ['length', 'width', 'quantity', purchase ? 'unitPrice' : 'unitPriceTtc'];
    const next = order[order.indexOf(key) + 1];
    if (next) { lineInputs.current[`${index}-${next}`]?.focus(); lineInputs.current[`${index}-${next}`]?.select(); }
    else if (index === items.length - 1) addLine();
    else lineInputs.current[`${index + 1}-length`]?.focus();
  }
  function contactAdded(contact: Party) { setParties(current => [...current, contact].sort((a, b) => a.name.localeCompare(b.name))); setPartyId(contact.id); }
  const centsTotal = (key: 'ht' | 'tva' | 'ttc') => amounts.reduce((sum, value) => sum + Math.round(value[key] * 100), 0) / 100;
  const lastMarker = items.reduce((last, item, i) => item.subtotalAfter ? i : last, -1);
  const running = amounts.slice(lastMarker + 1).reduce((sum, a) => sum + Math.round(a.ttc * 100), 0) / 100;
  let groupPcs = 0, groupArea = 0, groupCents = 0;

  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving) return; setError('');
    if (hasEntryIssue) { const invalid = items.findIndex((_, index) => lineErrors[index]); lineInputs.current[`${invalid}-quantity`]?.focus(); return; }
    if (!partyId || !items.length || items.some(line => !line.productId || line.length <= 0 || line.width <= 0 || line.quantity < 1 || !Number.isInteger(line.quantity))) { setError('Choisissez un contact et un article pour chaque ligne. Longueur, largeur et PCS doivent être positifs.'); return; }
    setSaving(true);
    try {
      const body = { [purchase ? 'supplierId' : 'clientId']: partyId, date, ...(purchase && code ? { code } : {}), ...(purchase ? {} : { status, notes }), paymentMethod: method || null, items: items.map(item => ({ ...item, tvaPercent: 20 })) };
      const result = id ? await http.put<MarbleDocument>(`${base}/${id}`, body) : await http.post<MarbleDocument>(base, body);
      setCode(result.data.code);
      toast({ title: purchase ? "Bon d'achat enregistré" : 'Facture enregistrée', description: `N° ${result.data.code}` }); navigate(`${base}/${result.data.id}`);
    } catch (e: unknown) { const err = e as { response?: { data?: { message?: string } } }; setError(err.response?.data?.message || 'Enregistrement impossible. Réessayez.'); if (!purchase) void refreshStock(); }
    finally { setSaving(false); }
  }

  if (loading) return <LoadingSpinner />;
  return <form onSubmit={save} className="document-editor p-4 pb-36 lg:p-8 lg:pb-28 space-y-6 max-w-[1600px] mx-auto">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to={base} className="inline-flex gap-2 text-sm text-muted-foreground mb-3"><ArrowLeft size={16} />Retour aux documents</Link>
        <p className="stone-kicker">ARABIC STONE · {purchase ? 'Achats' : 'Ventes'}</p><h1 className="text-2xl lg:text-3xl font-semibold mt-1">{id ? 'Modifier' : 'Créer'} {purchase ? "un bon d'achat" : 'une facture'}</h1></div>
      <Button type="submit" disabled={saving || hasEntryIssue || !products.length || !parties.length}><Save size={16} className="mr-2" />{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
    </div>
    {totalTooHigh && <div role="alert" className="border border-destructive/30 text-destructive rounded-lg p-4">Total du document : maximum 999 999 999 999,99 MAD TTC.</div>}
    {error && <div role="alert" className="border border-destructive/30 text-destructive bg-destructive/5 rounded-lg p-4">{error}</div>}
    {(!products.length || !parties.length) && <div className="p-4 border rounded-lg bg-secondary">Ajoutez d'abord <Link className="underline" to="/products">un article</Link> et <Link className="underline" to={purchase ? '/suppliers' : '/clients'}>{purchase ? 'un fournisseur' : 'un client'}</Link>.</div>}
    <Card><CardContent className="pt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      <div className="space-y-2 xl:col-span-2"><Label htmlFor="party">{purchase ? 'Fournisseur' : 'Client'}</Label><div className="flex gap-2"><SearchSelect id="party" label={purchase ? 'Fournisseur' : 'Client'} value={partyId} onChange={setPartyId} placeholder={purchase ? 'Rechercher un fournisseur…' : 'Rechercher un client…'} options={parties.map(p => ({ value: p.id, label: p.name, detail: [p.phone, p.address].filter(Boolean).join(' · ') }))} />{!restricted && <Button type="button" variant="outline" size="icon" className="shrink-0" aria-label={purchase ? 'Nouveau fournisseur' : 'Nouveau client'} title={purchase ? 'Créer un fournisseur sans quitter le document' : 'Créer un client sans quitter la facture'} onClick={() => setAddContactOpen(true)}><Plus size={16} /></Button>}</div></div>
      <div className="space-y-2"><Label htmlFor="date">Date</Label><Input id="date" type="date" value={date} onChange={e => changeDate(e.target.value)} required /></div>
      <div className="space-y-2"><Label htmlFor="code">Numéro automatique</Label><Input id="code" value={code} readOnly aria-describedby="invoice-number-help" aria-busy={numberLoading} className="bg-muted border-dashed text-muted-foreground" placeholder={numberLoading ? 'Calcul du numéro…' : "Attribué à l'enregistrement"} /><p id="invoice-number-help" className="text-[11px] text-muted-foreground">{purchase ? id ? 'Le numéro de ce document est conservé.' : 'Aucune saisie nécessaire.' : 'Format NN-MM-YYYY : séquence mensuelle à partir de 01, selon la date choisie. Numéro définitif à l’enregistrement ; conservé si le mois et l’année ne changent pas.'}</p>{!purchase && numberError && <p role="status" className="text-xs text-amber-700">{numberError}</p>}</div>
    </CardContent></Card>
    {!purchase && <div className="rounded-xl border bg-muted/30 p-4 space-y-2"><div className="flex flex-wrap justify-between items-center gap-3"><div><p className="text-sm font-medium">Stock à titre indicatif</p><p className="text-xs text-muted-foreground mt-1">Les lignes du même article partagent le stock, même après un sous-total.{id ? ' La surface de cette facture est réintégrée pour sa modification.' : ''}</p></div><Button type="button" variant="outline" size="sm" disabled={checkingStock} onClick={() => void refreshStock()}><RefreshCw size={14} className={`mr-2 ${checkingStock ? 'animate-spin' : ''}`} />{checkingStock ? 'Vérification…' : 'Actualiser le stock'}</Button></div>{stockError && <p role="alert" className="text-sm text-destructive">{stockError}</p>}{hasStockIssue && !stockError && <p role="status" className="text-xs text-destructive">Stock insuffisant sur certaines lignes. La facture peut être enregistrée ; le stock et les alertes seront recalculés automatiquement.</p>}</div>}
    <Card><div className="px-5 py-4 border-b flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">Articles & dimensions</h2><p className="text-xs text-muted-foreground mt-1">Longueur et largeur en cm. Les m² sont calculés automatiquement : longueur × largeur × PCS ÷ 10 000.</p></div><span className="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full self-center">TVA fixe 20 % · prix TTC / m²</span></div>
      <div className="overflow-x-auto"><table className="document-lines w-full table-fixed text-sm min-w-[940px]"><colgroup>{[24, 10, 10, 8, 12, 13, 14, 9].map((width, i) => <col key={i} style={{ width: `${width}%` }} />)}</colgroup><thead className="table-header-bg text-left text-xs uppercase"><tr>{['Article', 'Longueur (cm)', 'Largeur (cm)', 'PCS', 'm²', 'PU TTC MAD/m²', 'Montant TTC', ''].map((label, i) => <th key={i} className={`p-2 py-3 ${label === 'm²' ? 'normal-case' : ''}`}>{label}</th>)}</tr></thead><tbody>
        {items.map((line, index) => {
          const stock = lineStock[index];
          const inputError = lineErrors[index];
          const a = amounts[index]; groupPcs += Number(line.quantity) || 0; groupArea += a.totalSurface; groupCents += Math.round(a.ttc * 100);
          const subtotal = { pcs: groupPcs, surface: groupArea, total: groupCents / 100 };
          if (line.subtotalAfter) { groupPcs = 0; groupArea = 0; groupCents = 0; }
          const numeric = (key: 'length' | 'width' | 'quantity' | 'unitPrice' | 'unitPriceTtc', label: string, step: string, min: string) => <Input ref={element => { lineInputs.current[`${index}-${key}`] = element; }} aria-label={`${label} ligne ${index + 1}`} aria-invalid={!!inputError} aria-describedby={inputError || stock?.exceeds ? `stock-line-${index}` : undefined} className="min-w-[56px] px-2" inputMode={key === 'quantity' ? 'numeric' : 'decimal'} type="number" step={step} min={min} max={key === 'quantity' ? MARBLE_LIMITS.pieces : key === 'length' || key === 'width' ? MARBLE_LIMITS.dimension : MARBLE_LIMITS.price} required value={line[key] === 0 ? '' : line[key] ?? ''} onKeyDown={event => advance(event, index, key)} onChange={e => change(index, { [key]: e.target.value === '' ? 0 : Number(e.target.value) })} />;
          return <Fragment key={index}><tr className={`document-line border-b align-top ${inputError || stock?.exceeds ? 'bg-destructive/5' : ''}`}><td className="p-2 w-56" data-label={`Article ${index + 1}`}><SearchSelect label={`Article ligne ${index + 1}`} value={line.productId} onChange={productId => selectProduct(index, productId)} placeholder="Rechercher un article…" options={products.map(p => ({ value: p.id, label: p.name, detail: `${p.code} · ${formatCurrency(Number(purchase ? p.lastPurchasePrice : p.salePrice))}/m² · Stock ${area(Number(p.quantity))} m²` }))} /><span className="text-[10px] text-muted-foreground pl-1">{line.product?.code || products.find(p => p.id === line.productId)?.code}</span>{line.productId && <p className={`text-[10px] mt-1 ${stock?.exceeds ? 'text-destructive' : 'text-muted-foreground'}`}>{purchase ? `Stock actuel : ${area(Number(products.find(p => p.id === line.productId)?.quantity || 0))} m²` : stock?.known ? `Disponible pour cette ligne : ${area(stock.available)} m²` : 'Disponibilité inconnue'}</p>}</td>
            <td className="p-2" data-label="Longueur (cm)">{numeric('length', 'Longueur', '.001', '.001')}</td><td className="p-2" data-label="Largeur (cm)">{numeric('width', 'Largeur', '.001', '.001')}</td>
            <td className="p-2" data-label="PCS">{numeric('quantity', 'PCS', '1', '1')}</td><td data-label="m²" className="p-3 text-right tabular-nums whitespace-nowrap">{area(a.totalSurface)}<div className="text-[10px] text-muted-foreground">{area(a.surface)} / pièce</div></td>
            <td data-label="PU TTC MAD/m²" className="p-2">{numeric(purchase ? 'unitPrice' : 'unitPriceTtc', 'Prix TTC par m²', '.01', '0')}</td>
            <td data-label="Montant TTC" className="p-2 text-right font-semibold whitespace-nowrap">{formatCurrency(a.ttc)}</td><td className="p-2 whitespace-nowrap"><Button aria-label={`Dupliquer ligne ${index + 1}`} disabled={hasEntryIssue} title="Dupliquer cette ligne" variant="ghost" size="icon" className="h-8 w-8" type="button" onClick={() => duplicateLine(index)}><Copy size={15} /></Button><Button aria-label={`Supprimer ligne ${index + 1}`} variant="ghost" size="icon" className="h-8 w-8" type="button" onClick={() => setItems(current => current.filter((_, i) => i !== index))}><Trash2 size={15} /></Button></td></tr>
            {(inputError || stock?.exceeds) && <tr className="document-line-warning bg-destructive/5"><td colSpan={8} className="px-3 pb-3 pt-1"><p id={`stock-line-${index}`} role="alert" className="text-xs text-destructive">Ligne {index + 1} — {inputError || (stock.known ? `Alerte stock : demandé ${area(stock.requested)} m², disponible ${area(stock.available)} m².${stock.maxPieces !== null ? ` Équivalent disponible : ${stock.maxPieces} PCS avec ces dimensions.` : ''}` : 'Disponibilité inconnue pour cet article. Cette alerte ne bloque pas la facture.')}</p></td></tr>}
            {line.subtotalAfter && <tr className="document-line-subtotal bg-secondary font-semibold border-b"><td colSpan={3} className="p-3">Sous-total</td><td data-label="PCS" className="p-3">{subtotal.pcs}</td><td data-label="m²" className="p-3 text-right">{area(subtotal.surface)}</td><td></td><td className="p-3 text-right whitespace-nowrap">{formatCurrency(subtotal.total)}</td><td><Button variant="ghost" size="sm" type="button" aria-label={`Retirer sous-total ${index + 1}`} onClick={() => change(index, { subtotalAfter: false })}>×</Button></td></tr>}
          </Fragment>;
        })}
      </tbody></table></div>
      <div className="document-line-actions p-4 flex flex-wrap gap-3 border-b"><Button variant="outline" type="button" onClick={() => addLine()} disabled={hasEntryIssue || !items[items.length - 1]?.productId}><Ruler size={16} className="mr-2" />Même article, autre dimension</Button><Button variant="outline" type="button" onClick={() => addLine(false)} disabled={hasEntryIssue}><Plus size={16} className="mr-2" />Autre article</Button><Button variant="outline" type="button" disabled={hasEntryIssue || !items.length || items[items.length - 1].subtotalAfter} onClick={() => change(items.length - 1, { subtotalAfter: true })}><ListPlus size={16} className="mr-2" />Ajouter un sous-total</Button></div>
      <div className="p-5 flex flex-col md:flex-row justify-between gap-5"><div className="max-w-md"><p className="text-sm text-muted-foreground">Sous-total en cours</p><p className="text-2xl font-semibold mt-1">{formatCurrency(running)}</p><p className="text-xs text-muted-foreground mt-2">Toutes les lignes depuis le dernier sous-total, quel que soit l'article. Le prochain sous-total commence à zéro.</p></div>
        <dl className="min-w-64 space-y-3 text-sm"><div className="flex justify-between gap-6"><dt>Total HT</dt><dd>{formatCurrency(centsTotal('ht'))}</dd></div><div className="flex justify-between gap-6"><dt>TVA 20 %</dt><dd>{formatCurrency(centsTotal('tva'))}</dd></div><div className="flex justify-between gap-6 pt-3 border-t font-bold text-lg"><dt>Total TTC</dt><dd>{formatCurrency(centsTotal('ttc'))}</dd></div>{paid > 0 && <div className="flex justify-between gap-6"><dt>Déjà payé</dt><dd>{formatCurrency(paid)}</dd></div>}</dl></div>
    </Card>
      {!restricted && <Card><CardContent className="pt-5"><details><summary className="text-sm text-muted-foreground cursor-pointer">Options : mode de paiement{purchase ? '' : ' et déclaration'}</summary><div className="grid md:grid-cols-2 gap-5 mt-4">
      <div className="space-y-2"><Label htmlFor="method">Mode de paiement</Label><select id="method" className={selectStyle} value={method} onChange={e => setMethod(e.target.value)}>
        {!purchase && <option value="">Non précisé</option>}<option value={purchase ? 'CASH' : 'ESPECE'}>Espèces</option><option value={purchase ? 'BANK_TRANSFER' : 'VIREMENT'}>Virement</option><option value={purchase ? 'CHECK' : 'CHEQUE'}>Chèque</option><option value={purchase ? 'CREDIT_CARD' : 'LCN'}>{purchase ? 'Carte' : 'LCN'}</option></select></div>
      {!purchase && <div className="space-y-2"><Label htmlFor="status">Déclaration</Label><select id="status" className={selectStyle} value={status} onChange={e => { if (e.target.value !== status) setPendingDeclaration(e.target.value as DeclarationStatus); }}><option value="NOT_DECLARED">Non déclarée</option><option value="DECLARED">Déclarée</option></select></div>}
      </div></details></CardContent></Card>}
    {!purchase && !restricted && <Card><CardContent className="pt-5 space-y-2"><Label htmlFor="invoice-notes">Notes internes</Label><Textarea id="invoice-notes" maxLength={4000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Instructions, suivi ou remarques concernant cette facture…" aria-describedby="invoice-notes-help" /><p id="invoice-notes-help" className="text-xs text-muted-foreground">Visibles uniquement dans les informations de la facture. Elles ne figurent ni sur l'impression ni sur le PDF.</p></CardContent></Card>}
    <div role="region" aria-label="Récapitulatif et enregistrement" className="document-savebar fixed bottom-0 left-0 lg:left-64 right-0 z-20 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border bg-card/95 backdrop-blur px-4 lg:px-8 py-3 shadow-lg"><div><p className="text-xs text-muted-foreground">{items.length} ligne(s) · Total TTC</p><p className="text-xl font-semibold">{formatCurrency(centsTotal('ttc'))}</p></div><div className="flex gap-3"><Button variant="outline" type="button" onClick={() => navigate(base)}>Annuler</Button><Button type="submit" disabled={saving || hasEntryIssue || !items.length || !products.length || !parties.length}><Save size={16} className="mr-2" />{saving ? 'Enregistrement…' : id ? 'Enregistrer les modifications' : 'Créer et voir le document'}</Button></div></div>
    {!restricted && (purchase ? <AddSupplierDialog isOpen={addContactOpen} onOpenChange={setAddContactOpen} onSave={contactAdded} /> : <AddClientDialog isOpen={addContactOpen} onOpenChange={setAddContactOpen} onSave={contactAdded} />)}
    <DeclarationConfirmation open={pendingDeclaration !== null} code={code || undefined} current={status === 'DECLARED' ? 'DECLARED' : 'NOT_DECLARED'} next={pendingDeclaration || 'NOT_DECLARED'} onCancel={() => setPendingDeclaration(null)} onConfirm={() => { if (pendingDeclaration) setStatus(pendingDeclaration); setPendingDeclaration(null); }} />
  </form>;
}
