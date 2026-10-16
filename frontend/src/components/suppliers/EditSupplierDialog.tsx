import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { updateSupplier, getSupplier, Supplier } from '@/api/suppliers';
import { useToast } from '@/hooks/use-toast';

interface EditSupplierDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  supplierId: string | null;
  onSave: (supplier: Supplier) => void;
}

export const EditSupplierDialog = ({
  isOpen,
  onOpenChange,
  supplierId,
  onSave,
}: EditSupplierDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingSupplier, setLoadingSupplier] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    if (isOpen && supplierId) {
      loadSupplier();
    } else if (!isOpen) {
      // Reset form when dialog closes
      setFormData({
        name: '',
        phone: '',
        address: '',
      });
    }
  }, [isOpen, supplierId]);

  const loadSupplier = async () => {
    if (!supplierId) return;
    try {
      setLoadingSupplier(true);
      const supplier = await getSupplier(supplierId);
      setFormData({
        name: supplier.name,
        phone: supplier.phone || '',
        address: supplier.address || '',
      });
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message || 'Erreur lors du chargement',
        variant: 'destructive',
      });
      onOpenChange(false);
    } finally {
      setLoadingSupplier(false);
    }
  };

  const handleSubmit = async () => {
    if (!supplierId) return;
    if (!formData.name.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le nom est requis',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);
      const supplier = await updateSupplier(supplierId, {
        name: formData.name.trim(),
        phone: formData.phone || undefined,
        address: formData.address || undefined,
      });
      onSave(supplier);
      toast({ 
        title: 'Fournisseur modifié avec succès',
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message || 'Erreur lors de la modification',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le Fournisseur</DialogTitle>
          <DialogDescription>
            Modifiez les informations du fournisseur
          </DialogDescription>
        </DialogHeader>
        {loadingSupplier ? (
          <div className="py-8 text-center text-muted-foreground">Chargement...</div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="editSupplierName">Nom *</Label>
                <Input
                  id="editSupplierName"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="editSupplierPhone">Téléphone</Label>
                <Input
                  id="editSupplierPhone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="editSupplierAddress">Adresse</Label>
                <Input
                  id="editSupplierAddress"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Annuler
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

