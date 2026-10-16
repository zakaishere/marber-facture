import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Layers } from 'lucide-react';
import { getProducts, deleteProduct, type Product } from '@/api/products';
import { getCategories, type Category } from '@/api/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Categories from './Categories';
import { formatCurrency, formatPercent } from '@/utils/tva';
import LoadingSpinner from '@/components/LoadingSpinner';
import { surfaceLabel } from '@/components/DashboardStock';

export default function Products() {
  const [params, setParams] = useSearchParams();
  const lowStock = params.get('lowStock') === 'true';
  const [categoriesOpen, setCategoriesOpen] = useState(params.get('categories') === 'manage');
  function toggleCategories(open: boolean) { setCategoriesOpen(open); if (!open && params.has('categories')) { const next = new URLSearchParams(params); next.delete('categories'); setParams(next, { replace: true }); } }
  async function categoriesChanged() { try { const rows = await getCategories({ limit: 10000 }); setCategories(rows); setCategory(current => rows.some(row => row.id === current) ? current : ''); setRevision(value => value + 1); } catch { setError('Actualisation des catégories impossible.'); } }
  const [products, setProducts] = useState<Product[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  useEffect(() => { getCategories({ limit: 10000 }).then(setCategories).catch(() => setError('Chargement des catégories impossible.')); }, []);
  useEffect(() => {
    let active = true; const timer = setTimeout(() => { setLoading(true); getProducts({ search, categoryId: category || undefined, lowStock, limit: 10000 }).then(rows => { if (active) { setProducts(rows); setError(''); } }).catch(e => { if (active) setError(e.response?.data?.message || 'Chargement impossible.'); }).finally(() => { if (active) setLoading(false); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [search, category, revision, lowStock]);
  async function remove(product: Product) { if (!window.confirm(`Supprimer ${product.name} ?`)) return; try { await deleteProduct(product.id); setRevision(v => v + 1); } catch (e: unknown) { const err = e as { response?: { data?: { message?: string } } }; setError(err.response?.data?.message || 'Suppression impossible.'); } }
  return <div className="p-4 lg:p-8 max-w-[1500px] mx-auto space-y-6"><div className="flex flex-wrap justify-between gap-4 items-center"><div><p className="stone-kicker">Catalogue</p><h1 className="text-3xl font-semibold mt-1">Stock</h1><p className="text-muted-foreground mt-2 text-sm">Vos matériaux, leurs prix au m² et leur TVA. Les dimensions sont saisies sur chaque document.</p></div><Button asChild><Link to="/products/new"><Plus size={16} className="mr-2" />Nouvel article</Link></Button></div>
    <div className="flex gap-3 flex-wrap"><div className="relative flex-1 min-w-52"><Search className="absolute left-3 top-3 text-muted-foreground" size={16} /><Input className="pl-9 bg-white" placeholder="Rechercher un article…" aria-label="Rechercher un article" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="Catégorie" className="border rounded-md px-3 bg-white text-sm h-10" value={category} onChange={e => setCategory(e.target.value)}><option value="">Toutes les catégories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button variant="outline" onClick={() => toggleCategories(true)}><Layers size={16} className="mr-2" />Gérer les catégories</Button></div>
    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={lowStock} onChange={e => setParams(e.target.checked ? { lowStock: 'true' } : {})} />Afficher uniquement les alertes stock faible</label>
    <p className="text-xs text-muted-foreground">Stock automatique = surfaces achetées − surfaces facturées (longueur × largeur × PCS). Le seuil automatique couvre 7 jours de ventes selon les 30 derniers jours.</p>
    <Dialog open={categoriesOpen} onOpenChange={toggleCategories}><DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Gérer les catégories</DialogTitle><DialogDescription>Ajoutez, modifiez ou supprimez les catégories de vos articles sans quitter le stock.</DialogDescription></DialogHeader><Categories embedded onChanged={() => void categoriesChanged()} /></DialogContent></Dialog>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <Card className="overflow-hidden">{loading ? <LoadingSpinner /> : <div className="overflow-x-auto"><table className="mobile-record-table w-full text-sm"><thead className="table-header-bg text-left text-xs uppercase tracking-wide"><tr>{['Référence', 'Article', 'Catégorie', 'Achat TTC/m²', 'Vente TTC/m²', 'Stock m²', 'Seuil alerte m²', 'TVA', ''].map((label, i) => <th key={i} className="px-5 py-4">{label}</th>)}</tr></thead><tbody>{products.map(p => <tr key={p.id} className="border-t hover:bg-muted/40"><td data-label="Référence" className="px-5 py-4 text-primary font-medium">{p.code}</td><td data-label="Article" className="px-5 py-4 font-semibold">{p.name}</td><td data-label="Catégorie" className="px-5 py-4 text-muted-foreground">{p.category?.name}</td><td data-label="Achat TTC/m²" className="px-5 py-4 whitespace-nowrap">{formatCurrency(Number(p.lastPurchasePrice))}</td><td data-label="Vente TTC/m²" className="px-5 py-4 whitespace-nowrap">{formatCurrency(Number(p.salePrice))}</td><td data-label="Stock m²" className={`px-5 py-4 whitespace-nowrap ${Number(p.quantity) <= 0 ? 'text-destructive' : Number(p.quantity) <= Number(p.alertThreshold) ? 'text-amber-700' : ''}`}>{surfaceLabel(p.quantity)}</td><td data-label="Seuil alerte m²" className="px-5 py-4 whitespace-nowrap text-muted-foreground">{surfaceLabel(p.alertThreshold)}</td><td data-label="TVA" className="px-5 py-4">{formatPercent(Number(p.tvaRate))}</td><td data-label="Actions" className="px-4 py-3 whitespace-nowrap"><Button variant="ghost" size="icon" asChild><Link to={`/products/${p.id}/edit`} aria-label={`Modifier ${p.name}`}><Pencil size={15} /></Link></Button><Button variant="ghost" size="icon" aria-label={`Supprimer ${p.name}`} onClick={() => remove(p)}><Trash2 size={15} /></Button></td></tr>)}</tbody></table>{!products.length && <p className="p-12 text-center text-muted-foreground">Aucun article. Ajoutez votre premier marbre ou modifiez la recherche.</p>}</div>}</Card></div>;
}
