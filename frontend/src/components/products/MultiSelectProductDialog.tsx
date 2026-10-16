import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Product } from '@/api/products';
import { Category } from '@/api/categories';
import { Search, PackageX } from 'lucide-react';

interface MultiSelectProductDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  products: Product[];
  categories: Category[];
  alreadySelectedIds: string[];
  onAddProducts: (products: Product[]) => void;
}

export const MultiSelectProductDialog = ({
  isOpen,
  onOpenChange,
  products,
  categories,
  alreadySelectedIds,
  onAddProducts,
}: MultiSelectProductDialogProps) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedIds(new Set());
      setSearch('');
      setSelectedCategoryId('all');
    }
    onOpenChange(open);
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (Number(p.quantity) <= 0) return false;
      if (alreadySelectedIds.includes(p.id)) return false;
      if (selectedCategoryId !== 'all' && p.categoryId !== selectedCategoryId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, alreadySelectedIds, selectedCategoryId, search]);

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map((p) => p.id)));
    }
  };

  const handleAdd = () => {
    const selected = products.filter((p) => selectedIds.has(p.id));
    onAddProducts(selected);
    handleOpenChange(false);
  };

  const allChecked = filteredProducts.length > 0 && selectedIds.size === filteredProducts.length;
  const indeterminate = selectedIds.size > 0 && selectedIds.size < filteredProducts.length;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col" style={{ maxHeight: '90vh' }}>
        <DialogHeader className="shrink-0">
          <DialogTitle>Sélectionner les produits</DialogTitle>
          <DialogDescription>
            Filtrez par catégorie, recherchez et sélectionnez plusieurs produits à la fois.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="space-y-3 shrink-0">
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger>
              <SelectValue placeholder="Toutes les catégories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Rechercher par nom ou code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Select All Row */}
        {filteredProducts.length > 0 && (
          <div className="flex items-center gap-3 py-2 border-b shrink-0">
            <Checkbox
              id="select-all"
              checked={indeterminate ? 'indeterminate' : allChecked}
              onCheckedChange={toggleAll}
            />
            <Label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer select-none">
              Tout sélectionner ({filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''})
            </Label>
          </div>
        )}

        {/* Product List */}
        <div className="flex-1 overflow-y-auto space-y-1 min-h-0 pr-1">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <PackageX className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm font-medium">Aucun produit disponible</p>
              <p className="text-xs mt-1 text-center">
                {search
                  ? 'Essayez une autre recherche'
                  : selectedCategoryId !== 'all'
                    ? 'Aucun produit en stock dans cette catégorie'
                    : 'Tous les produits sont déjà ajoutés ou hors stock'}
              </p>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const isChecked = selectedIds.has(product.id);
              const isLowStock = product.quantity <= product.minStock && product.minStock > 0;
              return (
                <div
                  key={product.id}
                  onClick={() => toggleProduct(product.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors border ${
                    isChecked
                      ? 'bg-primary/10 border-primary/40'
                      : 'hover:bg-muted/60 border-transparent'
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleProduct(product.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{product.name}</div>
                    <div className="text-xs text-muted-foreground">{product.code}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge
                      variant={isLowStock ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      Stock: {product.quantity}
                    </Badge>
                    <span className="text-xs font-medium">
                      {product.salePrice.toLocaleString()} DH
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="flex-col sm:flex-row items-center gap-2 pt-3 border-t shrink-0">
          <span className="flex-1 text-sm text-muted-foreground text-left">
            {selectedIds.size > 0
              ? `${selectedIds.size} produit${selectedIds.size > 1 ? 's' : ''} sélectionné${selectedIds.size > 1 ? 's' : ''}`
              : 'Aucune sélection'}
          </span>
          <Button variant="outline" onClick={() => handleOpenChange(false)} type="button">
            Annuler
          </Button>
          <Button onClick={handleAdd} disabled={selectedIds.size === 0} type="button">
            Ajouter ({selectedIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
