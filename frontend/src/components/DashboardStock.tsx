import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import type { Product, ProductSummary } from '@/api/products';
import { Card, CardContent } from '@/components/ui/card';
export interface StockOverview extends ProductSummary { lowStock: Product[] }
export const surfaceLabel = (value: number) => `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} m²`;
export default function DashboardStock({ stock }: { stock: StockOverview }) {
  return <Card className="overflow-hidden"><div className="stone-panel-heading"><h2>Alertes stock faible ({stock.lowStockCount})</h2><Link to="/products?lowStock=true" className="stone-see-all">Tout voir <ArrowUpRight size={13} /></Link></div><CardContent className="pt-5"><p className="text-[11px] text-muted-foreground">Bons d'achat actifs − factures clients · calcul automatique</p>
    {Number(stock.negativeStockCount) > 0 && <p role="alert" className="text-xs text-destructive bg-red-50 border border-red-100 rounded-lg p-3 mt-4">{stock.negativeStockCount} article(s) avec plus de ventes que d'achats enregistrés. Complétez les bons d'achat manquants. Ces soldes négatifs ne sont pas inclus dans le stock disponible.</p>}
    <div className="space-y-2 mt-4">{stock.lowStock.map(product => <Link key={product.id} to={`/products/${product.id}/edit`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted"><AlertTriangle size={16} className={Number(product.quantity) <= 0 ? 'text-destructive shrink-0' : 'text-amber-600 shrink-0'} /><div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{product.name}</p><p className="text-[11px] text-muted-foreground mt-1">{Number(product.quantity) < 0 ? 'Achats à compléter' : Number(product.quantity) === 0 ? 'Rupture de stock' : 'À réapprovisionner'} · {surfaceLabel(product.quantity)}</p><p className="text-[10px] text-muted-foreground">Seuil : {surfaceLabel(product.alertThreshold)}</p></div><ArrowUpRight size={13} className="shrink-0 text-muted-foreground" /></Link>)}{!stock.lowStock.length && <p className="text-sm text-muted-foreground py-3">Aucune alerte de stock.</p>}</div>
    <p className="text-[10px] text-muted-foreground leading-relaxed mt-4">Alerte automatique quand le solde couvre au plus 7 jours de ventes, selon les 30 derniers jours. Sans ventes récentes, une alerte apparaît à zéro.</p>
  </CardContent></Card>;
}
