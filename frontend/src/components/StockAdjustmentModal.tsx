import { useState } from 'react';
import { adjustProductStock, Product } from '@/api/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface StockAdjustmentModalProps {
  product: Product;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const StockAdjustmentModal = ({
  product,
  open,
  onClose,
  onSuccess,
}: StockAdjustmentModalProps) => {
  const { toast } = useToast();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delta || !reason) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      await adjustProductStock(product.id, {
        delta: Number(delta),
        reason,
      });
      toast({ title: 'Stock ajusté avec succès' });
      onSuccess();
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message || 'Erreur lors de l\'ajustement',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Ajuster le stock</DialogTitle>
            <DialogDescription>
              Produit: {product.name} (Stock actuel: {product.quantity})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="delta">
                Delta (positif pour ajouter, négatif pour retirer)
              </Label>
              <Input
                id="delta"
                type="number"
                value={delta}
                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                onChange={(e) => setDelta(e.target.value)}
                placeholder="Ex: 10 ou -5"
                required
              />
            </div>

            <div>
              <Label htmlFor="reason">Raison</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Articles endommagés, inventaire..."
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Ajustement...' : 'Ajuster'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default StockAdjustmentModal;
