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
import { createSupplier, Supplier } from '@/api/suppliers';
import { useToast } from '@/hooks/use-toast';

interface AddSupplierDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (supplier: Supplier) => void;
}

export const AddSupplierDialog = ({
  isOpen,
  onOpenChange,
  onSave,
}: AddSupplierDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  });

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setFormData({
        name: '',
        phone: '',
        address: '',
      });
    }
  }, [isOpen]);

  const handleSubmit = async () => {
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
      const supplier = await createSupplier({
        name: formData.name.trim(),
        phone: formData.phone || undefined,
        address: formData.address || undefined,
      });
      onSave(supplier);
      toast({ 
        title: 'Fournisseur créé avec succès',
      });
      // Reset form
      setFormData({
        name: '',
        phone: '',
        address: '',
      });
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message || 'Erreur lors de la création',
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
          <DialogTitle>Nouveau Fournisseur</DialogTitle>
          <DialogDescription>
            Créez rapidement un nouveau fournisseur
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="newSupplierName">Nom *</Label>
            <Input
              id="newSupplierName"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="newSupplierPhone">Téléphone</Label>
            <Input
              id="newSupplierPhone"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="newSupplierAddress">Adresse</Label>
            <Input
              id="newSupplierAddress"
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
            {loading ? 'Création...' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

