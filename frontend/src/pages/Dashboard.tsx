import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FileText, Users, Truck, Plus, ShoppingCart, Layers, CircleDollarSign, TrendingUp } from 'lucide-react';
import http from '@/api/http';
import { getProducts, type Product } from '@/api/products';
import type { MarbleDocument } from '@/models/document';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency } from '@/utils/tva';
import LoadingSpinner from '@/components/LoadingSpinner';
import DashboardAnalytics, { type MonthlyActivity } from '@/components/DashboardAnalytics';
import DashboardStock, { surfaceLabel, type StockOverview } from '@/components/DashboardStock';

interface Overview { sales: number; purchases: number; remaining: number; paid: number; invoiceCount: number; clientCount: number; supplierCount: number; recentInvoices: MarbleDocument[]; monthly?: MonthlyActivity[]; currentMonth?: MonthlyActivity; previousMonth?: MonthlyActivity; stock?: StockOverview }
export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [error, setError] = useState('');
  const [storage, setStorage] = useState('checking');
  useEffect(() => {
    let active = true; let pending = false;
    async function refresh() {
      if (pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { const [r, catalogue] = await Promise.all([http.get<Overview>('/dashboard'), getProducts({ limit: 5 }).catch(() => null)]); if (active) { setOverview(r.data); setError(''); setCatalogError(catalogue === null); if (catalogue) setProducts(catalogue); } }
      catch (e: unknown) { const err = e as { response?: { data?: { message?: string } } }; if (active) setError(err.response?.data?.message || 'Impossible de charger les données.'); }
      finally { pending = false; }
    }
    void refresh(); const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    http.get('/health').then(r => { if (active) setStorage(['temporary', 'persistent'].includes(r.data.storage) ? r.data.storage : 'unknown'); }).catch(() => { if (active) setStorage('unknown'); });
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  if (error && !overview) return <p role="alert" className="p-8 text-destructive">{error} <button className="underline ml-2" onClick={() => window.location.reload()}>Réessayer</button></p>;
  if (!overview) return <LoadingSpinner />;
  const collection = Number(overview.sales) > 0 ? Math.max(0, Math.min(100, Number(overview.paid) / Number(overview.sales) * 100)) : 0;
  const metrics = [
    { label: 'Stock total disponible', value: surfaceLabel(overview.stock?.totalQuantity || 0), hint: 'Surfaces positives par article · calcul automatique', Icon: Layers },
    { label: 'Ventes du mois TTC', value: formatCurrency(Number(overview.currentMonth?.sales || 0)), hint: `Mois précédent entier : ${formatCurrency(Number(overview.previousMonth?.sales || 0))}`, Icon: TrendingUp },
    { label: 'Factures du mois', value: overview.currentMonth?.invoiceCount || 0, hint: `${overview.invoiceCount} factures au total`, Icon: FileText },
    { label: 'Clients actifs du mois', value: overview.currentMonth?.activeClients || 0, hint: `${overview.clientCount} clients enregistrés`, Icon: Users },
  ];
  return <div className="dashboard-page p-4 lg:p-8 max-w-[1600px] mx-auto space-y-6">
    {error && <div role="alert" className="text-destructive text-sm border rounded-xl p-4">Actualisation impossible. Les chiffres affichés peuvent être anciens. {error}</div>}
    {storage !== 'checking' && storage !== 'persistent' && <div role="alert" className="border border-amber-300 bg-amber-50 text-amber-950 rounded-xl px-5 py-4 text-sm"><strong>{storage === 'temporary' ? 'Mode démonstration · données temporaires.' : 'Stockage permanent non confirmé.'}</strong> Utilisez le mode local permanent pour vos documents réels. Les données en mémoire disparaissent à l'arrêt du serveur.</div>}
    <div className="flex justify-between items-center gap-4"><div><p className="stone-kicker">L'essentiel, en un regard</p><h1 className="text-3xl lg:text-4xl mt-1">Tableau de bord</h1><p className="text-muted-foreground text-sm mt-2">Bienvenue {user?.username}. Votre activité commerciale, simplement.</p></div><span className="stone-date hidden sm:block">{new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
    <div className="flex flex-wrap gap-3"><Button asChild><Link to="/factures/new"><Plus size={16} className="mr-2" />Créer une facture</Link></Button><Button asChild variant="outline"><Link to="/bon-achat/new"><ShoppingCart size={16} className="mr-2" />Bon d'achat</Link></Button></div>
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">{metrics.map(({ label, value, hint, Icon }) => <Card key={label} className="stone-stat"><CardContent className="pt-5 pb-5"><div className="flex items-center gap-3"><span className="stone-icon"><Icon size={19} /></span><p className="text-sm text-muted-foreground">{label}</p></div><p className="text-2xl font-semibold mt-4 tabular-nums tracking-tight">{value}</p><p className="text-xs text-muted-foreground mt-2">{hint}</p></CardContent></Card>)}</div>
    <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-5 items-start">{overview.monthly && <DashboardAnalytics monthly={overview.monthly} />}{overview.stock && <DashboardStock stock={overview.stock} />}</div>
    <div className="grid xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] gap-5">
      <div className="space-y-5 min-w-0"><Card className="overflow-hidden"><div className="stone-panel-heading"><h2>Dernières factures</h2><Link to="/factures" className="stone-see-all">Tout voir <ArrowUpRight size={14} /></Link></div><div className="overflow-x-auto"><table className="mobile-record-table w-full text-sm text-left"><thead className="table-header-bg text-[11px] uppercase tracking-wider"><tr>{['Document / date', 'Client', 'Total TTC', 'Règlement'].map(label => <th key={label} className="p-4 font-medium">{label}</th>)}</tr></thead><tbody>{overview.recentInvoices.map(doc => <tr key={doc.id} className="border-t hover:bg-muted/40"><td data-label="Document / date" className="p-4"><Link className="font-semibold text-primary hover:underline" to={`/factures/${doc.id}`}>{doc.code}</Link><p className="text-xs text-muted-foreground mt-1">{doc.date}</p></td><td data-label="Client" className="p-4">{doc.client?.name}</td><td data-label="Total TTC" className="p-4 whitespace-nowrap font-medium">{formatCurrency(Number(doc.totalTtc))}</td><td data-label="Règlement" className="p-4 whitespace-nowrap"><span className={`stone-status ${Number(doc.remainingAmount) === 0 ? 'stone-status-paid' : ''}`}>{Number(doc.remainingAmount) === 0 ? 'Réglée' : Number(doc.paidAmount) > 0 ? 'Partielle' : 'À régler'}</span>{Number(doc.remainingAmount) > 0 && <p className="text-[11px] mt-2 text-muted-foreground">{formatCurrency(Number(doc.remainingAmount))} restant</p>}</td></tr>)}</tbody></table>{!overview.recentInvoices.length && <p className="p-10 text-center text-muted-foreground">Votre première facture apparaîtra ici.</p>}</div></Card>
      <Card className="overflow-hidden"><div className="stone-panel-heading"><h2>Marbres & pierres naturelles</h2><Link to="/products" className="stone-see-all">Le catalogue <ArrowUpRight size={14} /></Link></div><div className="overflow-x-auto"><table className="mobile-record-table w-full text-left text-sm"><thead className="table-header-bg text-[11px] uppercase tracking-wider"><tr><th className="px-5 py-3 font-medium">Matière / référence</th><th className="px-5 py-3 font-medium">Catégorie</th><th className="px-5 py-3 font-medium text-right">Stock m²</th><th className="px-5 py-3 font-medium text-right">Vente TTC / m²</th></tr></thead><tbody>{products.map((product, index) => <tr key={product.id} className="border-t"><td data-label="Matière / référence" className="px-5 py-3"><Link to={`/products/${product.id}/edit`} className="flex gap-3 items-center hover:text-primary"><span className={`stone-swatch stone-swatch-${index % 3}`} aria-hidden="true" /><span><strong className="block text-sm font-medium">{product.name}</strong><span className="text-[11px] text-muted-foreground">{product.code}</span></span></Link></td><td data-label="Catégorie" className="px-5 py-3 text-muted-foreground">{product.category?.name || '—'}</td><td data-label="Stock m²" className={`px-5 py-3 text-right whitespace-nowrap ${Number(product.quantity) <= 0 ? 'text-destructive' : ''}`}>{surfaceLabel(product.quantity)}</td><td data-label="Vente TTC/m²" className="px-5 py-3 text-right whitespace-nowrap font-medium">{formatCurrency(Number(product.salePrice))}</td></tr>)}</tbody></table>{!products.length && <p className="p-6 text-sm text-muted-foreground">{catalogError ? 'Le catalogue est momentanément indisponible.' : 'Ajoutez vos premières matières au catalogue.'}</p>}</div></Card></div>
      <div className="space-y-5"><Card><div className="stone-panel-heading"><h2>Suivi des encaissements</h2><CircleDollarSign size={18} className="text-primary" /></div><CardContent className="pt-5"><div className="flex items-end justify-between mb-4"><p className="text-4xl font-light tabular-nums">{collection.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}<span className="text-lg text-muted-foreground"> %</span></p><span className="text-xs text-muted-foreground">du total facturé</span></div><div role="progressbar" aria-label="Part des factures encaissée" aria-valuenow={Math.round(collection)} aria-valuemin={0} aria-valuemax={100} className="h-2.5 bg-secondary rounded-full overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${collection}%` }} /></div><p className="text-xs text-muted-foreground mt-4 leading-relaxed">{formatCurrency(Number(overview.paid))} encaissés sur {formatCurrency(Number(overview.sales))} facturés.</p><div className="text-xs space-y-2 border-t pt-3 mt-4"><p className="flex justify-between gap-2"><span>Reste à encaisser</span><strong>{formatCurrency(Number(overview.remaining))}</strong></p><p className="flex justify-between gap-2"><span>Bons d’achat actifs TTC</span><strong>{formatCurrency(Number(overview.purchases))}</strong></p></div><Button variant="outline" asChild className="w-full mt-5"><Link to="/factures">Consulter les factures <ArrowUpRight size={14} className="ml-auto" /></Link></Button></CardContent></Card>
      <Card><CardContent className="pt-4 pb-4 space-y-1">{[{ path: '/clients', Icon: Users, label: 'Clients', detail: `${overview.clientCount} contacts · documents & règlements` }, { path: '/suppliers', Icon: Truck, label: 'Fournisseurs', detail: `${overview.supplierCount} contacts · historique des achats` }].map(({ path, Icon, label, detail }) => <Link to={path} key={path} className="flex gap-3 items-center rounded-xl p-3 hover:bg-muted transition-colors"><span className="stone-icon"><Icon size={18} /></span><div className="flex-1"><p className="font-medium text-sm">{label}</p><p className="text-[11px] text-muted-foreground mt-1">{detail}</p></div><ArrowUpRight size={15} className="text-muted-foreground" /></Link>)}</CardContent></Card>
      <Link to="/products" className="stone-hero stone-editorial block rounded-xl p-7"><Layers size={24} className="text-[#c5a06e] mb-10" /><h2 className="text-2xl leading-snug">Des pierres naturelles<br /><em>d'exception.</em></h2><p className="stone-kicker mt-4 text-[9px]">Matière · Caractère · Élégance</p><span className="inline-flex gap-3 items-center text-xs border-b border-[#a58b63] pb-2 mt-7 text-[#e4cfb0]">Explorer les matières <ArrowUpRight size={14} /></span></Link></div>
    </div>
    <p className="text-[10px] text-muted-foreground text-center tracking-widest uppercase py-3">Arabic Stone · L'exigence du détail</p>
  </div>;
}
