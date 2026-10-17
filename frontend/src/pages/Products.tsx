import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Pencil, Trash2, Search, Layers, ImageIcon, AlertTriangle, Eye } from 'lucide-react';
import { getProducts, deleteProduct, type Product } from '@/api/products';
import { getCategories, type Category } from '@/api/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Categories from './Categories';
import { formatCurrency } from '@/utils/tva';
import { stockGroups, stockTotal } from '@/utils/stockGroups';
import LoadingSpinner from '@/components/LoadingSpinner';
import { surfaceLabel } from '@/components/DashboardStock';

export default function Products() {
  const [params, setParams] = useSearchParams();
  const lowStock = params.get('lowStock') === 'true';
  const [categoriesOpen, setCategoriesOpen] = useState(params.get('categories') === 'manage');
  function toggleCategories(open: boolean) { setCategoriesOpen(open); if (!open && params.has('categories')) { const next = new URLSearchParams(params); next.delete('categories'); setParams(next, { replace: true }); } }
  async function categoriesChanged() { try { const rows = await getCategories({ limit: 10000 }); setCategories(rows); setCategory(current => rows.some(row => row.id === current) ? current : ''); setRevision(value => value + 1); } catch { setError('Actualisation des catégories impossible.'); } }
  const [details, setDetails] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]); const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState(''); const [category, setCategory] = useState(''); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  useEffect(() => { getCategories({ limit: 10000 }).then(setCategories).catch(() => setError('Chargement des catégories impossible.')); }, []);
  useEffect(() => {
    let active = true; const timer = setTimeout(() => { setLoading(true); getProducts({ search, categoryId: category || undefined, lowStock, stockDetails: true, limit: 10000 }).then(rows => { if (active) { setProducts(rows); setError(''); } }).catch(e => { if (active) setError(e.response?.data?.message || 'Chargement impossible.'); }).finally(() => { if (active) setLoading(false); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [search, category, revision, lowStock]);
  async function remove(product: Product) { if (!window.confirm(`Supprimer ${product.name} ?`)) return; try { await deleteProduct(product.id); setRevision(v => v + 1); } catch (e: unknown) { const err = e as { response?: { data?: { message?: string } } }; setError(err.response?.data?.message || 'Suppression impossible.'); } }
  const groups = stockGroups(products);
  return <div className="p-4 lg:p-8 max-w-[1500px] mx-auto space-y-6"><div className="flex flex-wrap justify-between gap-4 items-center"><div><p className="stone-kicker">Catalogue</p><h1 className="text-3xl font-semibold mt-1">Stock</h1><p className="text-muted-foreground mt-2 text-sm">Vos matériaux regroupés par catégorie, leurs dimensions et leur stock disponible.</p></div><Button asChild><Link to="/products/new"><Plus size={16} className="mr-2" />Nouvel article</Link></Button></div>
    <div className="flex gap-3 flex-wrap"><div className="relative flex-1 min-w-52"><Search className="absolute left-3 top-3 text-muted-foreground" size={16} /><Input className="pl-9 bg-white" placeholder="Rechercher un article…" aria-label="Rechercher un article" value={search} onChange={e => setSearch(e.target.value)} /></div><select aria-label="Catégorie" className="border rounded-md px-3 bg-white text-sm h-10" value={category} onChange={e => setCategory(e.target.value)}><option value="">Toutes les catégories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><Button variant="outline" onClick={() => toggleCategories(true)}><Layers size={16} className="mr-2" />Gérer les catégories</Button></div>
    <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={lowStock} onChange={e => setParams(e.target.checked ? { lowStock: 'true' } : {})} />Afficher uniquement les alertes stock faible</label>
    <p className="text-xs text-muted-foreground">Stock automatique = surfaces achetées − surfaces facturées (longueur × largeur × PCS). Le seuil automatique couvre 7 jours de ventes selon les 30 derniers jours.</p>
    <Dialog open={categoriesOpen} onOpenChange={toggleCategories}><DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>Gérer les catégories</DialogTitle><DialogDescription>Ajoutez, modifiez ou supprimez les catégories de vos articles sans quitter le stock.</DialogDescription></DialogHeader><Categories embedded onChanged={() => void categoriesChanged()} /></DialogContent></Dialog>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!loading && <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><p>{products.length} article(s) · {groups.length} catégorie(s){(search || category || lowStock) && ' · Totaux des articles filtrés'}</p><details className="max-w-xl"><summary className="cursor-pointer text-primary">Comprendre les totaux</summary><p className="mt-2 leading-relaxed">Dimensions = formats avec pièces restantes ; quantité = PCS. Les totaux de prix représentent la valeur du stock aux prix TTC actuels (m² × prix), pas la somme des prix au m².</p></details></div>}
    {loading ? <Card><LoadingSpinner /></Card> : !products.length ? <Card><p className="p-12 text-center text-muted-foreground">Aucun article. Ajoutez votre premier marbre ou modifiez la recherche.</p></Card> : <Card className="overflow-hidden stock-catalogue">{groups.map(group => <section key={group.id} aria-label={`Stock : ${group.name}`}>
      <div className="stock-table-scroll"><table className="stock-table w-full text-sm">
        <caption className="sr-only">{group.name} — stock par article. Prix unitaires TTC par m² ; totaux en valeur du stock.</caption>
        <thead><tr><th scope="col" className="stock-name"><span className="stock-article-heading"><span className="stock-thumbnail"><Layers size={21} aria-hidden="true" /></span><span>{group.name}</span></span></th>{['Dimensions', 'Quantité', 'm²', 'Prix achat', 'Prix vente', 'Actions'].map(label => <th scope="col" key={label}>{label}{(label === 'Prix achat' || label === 'Prix vente') && <span className="block text-[10px] font-normal mt-1">TTC / m²</span>}{label === 'Quantité' && <span className="block text-[10px] font-normal mt-1">PCS</span>}</th>)}</tr></thead>
        <tbody>{group.products.map(product => {
          const warning = Number(product.quantity) <= Number(product.alertThreshold);
          return <tr className="stock-row" key={product.id}>
            <th scope="row" className="stock-name"><span className="stock-article-heading"><span className="stock-thumbnail"><ImageIcon size={21} aria-hidden="true" /></span><span className="min-w-0"><span className="font-semibold">{product.name}</span><span className="block text-[11px] text-muted-foreground font-normal mt-1">{product.code}</span>{warning && <span className={`flex items-center gap-1 text-[11px] font-medium mt-1 ${Number(product.quantity) <= 0 ? 'text-destructive' : 'text-amber-700'}`}><AlertTriangle size={12} aria-hidden="true" />{Number(product.quantity) < 0 ? 'Achats à compléter' : Number(product.quantity) === 0 ? 'Rupture de stock' : 'Stock faible'}</span>}</span></span></th>
            <td data-label="Dimensions">{Number(product.dimensionCount ?? 0).toLocaleString('fr-FR')}</td>
            <td data-label="Quantité (PCS)" className={Number(product.stockPieces) < 0 ? 'text-destructive' : ''}>{Number(product.stockPieces ?? 0).toLocaleString('fr-FR')}</td>
            <td data-label="m²" className={warning ? Number(product.quantity) <= 0 ? 'text-destructive' : 'text-amber-700' : ''}>{surfaceLabel(product.quantity)}</td>
            <td data-label="Prix achat TTC / m²">{formatCurrency(Number(product.lastPurchasePrice))}</td>
            <td data-label="Prix vente TTC / m²">{formatCurrency(Number(product.salePrice))}</td>
            <td data-label="Actions"><div className="flex gap-1 items-center"><Button variant="ghost" size="sm" aria-label={`Voir le stock de ${product.name}`} onClick={() => setDetails(product)}><Eye size={15} className="mr-1" />Voir</Button><Button variant="ghost" size="icon" asChild><Link to={`/products/${product.id}/edit`} aria-label={`Modifier ${product.name}`}><Pencil size={15} /></Link></Button><Button variant="ghost" size="icon" aria-label={`Supprimer ${product.name}`} onClick={() => remove(product)}><Trash2 size={15} /></Button></div></td>
          </tr>;
        })}</tbody>
        <tfoot><tr className="stock-category-total"><th scope="row">Total de la catégorie</th><td data-label="Dimensions">{group.dimensions.toLocaleString('fr-FR')}</td><td data-label="Quantité (PCS)">{group.pieces.toLocaleString('fr-FR')}</td><td data-label="m²">{stockTotal(group.surface, 6, ' m²')}</td><td data-label="Valeur achat TTC">{stockTotal(group.purchase, 2, ' MAD')}</td><td data-label="Valeur vente TTC">{stockTotal(group.sale, 2, ' MAD')}</td><td><span className="text-[10px] font-normal text-muted-foreground">Valeur du stock</span></td></tr></tfoot>
      </table></div>
    </section>)}</Card>}
    <Dialog open={!!details} onOpenChange={open => { if (!open) setDetails(null); }}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{details?.name}</DialogTitle><DialogDescription>Stock calculé depuis les achats actifs et les factures, regroupé par longueur et largeur en cm. Les soldes négatifs restent visibles pour signaler les achats manquants.</DialogDescription></DialogHeader>{details && <><div className="flex flex-wrap gap-4 text-sm"><p>Stock : <strong>{surfaceLabel(details.quantity)}</strong></p><p>Seuil d’alerte : <strong>{surfaceLabel(details.alertThreshold)}</strong></p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left bg-muted"><tr>{['Longueur (cm)', 'Largeur (cm)', 'PCS', 'm²'].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{details.stockDimensions?.map((row, i) => <tr key={i} className={`border-t ${Number(row.pieces) < 0 ? 'text-destructive' : ''}`}><td className="p-3">{Number(row.lengthCm).toLocaleString('fr-FR', { maximumFractionDigits: 5 })}</td><td className="p-3">{Number(row.widthCm).toLocaleString('fr-FR', { maximumFractionDigits: 5 })}</td><td className="p-3">{Number(row.pieces).toLocaleString('fr-FR')}</td><td className="p-3 whitespace-nowrap">{surfaceLabel(row.surfaceM2)}</td></tr>)}</tbody></table>{!details.stockDimensions?.length && <p className="text-sm text-muted-foreground py-5">Aucune dimension avec un solde restant.</p>}</div></>}</DialogContent></Dialog>
  </div>;
}
