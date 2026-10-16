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
import { createClient, Client } from '@/api/clients';
import { useToast } from '@/hooks/use-toast';

interface AddClientDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (client: Client) => void;
}

export const AddClientDialog = ({
  isOpen,
  onOpenChange,
  onSave,
}: AddClientDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    ice: '',
  });

  useEffect(() => {
    if (!isOpen) {
      // Reset form when dialog closes
      setFormData({
        name: '',
        phone: '',
        address: '',
        ice: '',
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
      const client = await createClient({
        name: formData.name.trim(),
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        ice: formData.ice || undefined,
      });
      onSave(client);
      toast({ 
        title: 'Client créé avec succès',
      });
      // Reset form
      setFormData({
        name: '',
        phone: '',
        address: '',
        ice: '',
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
          <DialogTitle>Nouveau Client</DialogTitle>
          <DialogDescription>
            Créez rapidement un nouveau client
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="newClientName">Nom *</Label>
            <Input
              id="newClientName"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
          <div>
            <Label htmlFor="newClientPhone">Téléphone</Label>
            <Input
              id="newClientPhone"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="newClientAddress">Adresse</Label>
            <Input
              id="newClientAddress"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
          </div>
          <div>
            <Label htmlFor="newClientIce">ICE (15 caractères max)</Label>
            <Input
              id="newClientIce"
              value={formData.ice}
              onChange={(e) =>
                setFormData({ ...formData, ice: e.target.value.slice(0, 15) })
              }
              maxLength={15}
              placeholder="Ex: 123456789012345"
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

