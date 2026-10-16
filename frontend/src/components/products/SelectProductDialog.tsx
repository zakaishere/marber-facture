import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Product } from '@/api/products';

interface SelectProductDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  products: Product[];
  onSelect: (product: Product) => void;
}

export const SelectProductDialog = ({
  isOpen,
  onOpenChange,
  products,
  onSelect,
}: SelectProductDialogProps) => {
  const handleSelect = (product: Product) => {
    onSelect(product);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sélectionner un produit</DialogTitle>
          <DialogDescription>
            Recherchez un produit et cliquez pour l'ajouter automatiquement.
          </DialogDescription>
        </DialogHeader>
        <Command>
          <CommandInput placeholder="Rechercher par nom ou code..." />
          <CommandList>
            <CommandEmpty>Aucun produit trouvé.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={`${product.name} ${product.code}`}
                  onSelect={() => handleSelect(product)}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.code}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          product.quantity <= product.minStock
                            ? 'destructive'
                            : product.quantity <= product.minStock * 2
                              ? 'secondary'
                              : 'outline'
                        }
                        className="text-xs"
                      >
                        Stock: {product.quantity}
                      </Badge>
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-muted-foreground">
                          Prix: {product.salePrice.toLocaleString()} DH
                        </span>
                        {product.lastPurchasePrice > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            Achat: {product.lastPurchasePrice.toLocaleString()} DH
                          </span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" className="text-xs">
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

