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
import { updateClient, getClient, Client } from '@/api/clients';
import { useToast } from '@/hooks/use-toast';

interface EditClientDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  clientId: string | null;
  onSave: (client: Client) => void;
}

export const EditClientDialog = ({
  isOpen,
  onOpenChange,
  clientId,
  onSave,
}: EditClientDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingClient, setLoadingClient] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    ice: '',
  });

  useEffect(() => {
    if (isOpen && clientId) {
      loadClient();
    } else if (!isOpen) {
      // Reset form when dialog closes
      setFormData({
        name: '',
        phone: '',
        address: '',
        ice: '',
      });
    }
  }, [isOpen, clientId]);

  const loadClient = async () => {
    if (!clientId) return;
    try {
      setLoadingClient(true);
      const client = await getClient(clientId);
      setFormData({
        name: client.name,
        phone: client.phone || '',
        address: client.address || '',
        ice: client.ice || '',
      });
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message || 'Erreur lors du chargement',
        variant: 'destructive',
      });
      onOpenChange(false);
    } finally {
      setLoadingClient(false);
    }
  };

  const handleSubmit = async () => {
    if (!clientId) return;
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
      const client = await updateClient(clientId, {
        name: formData.name.trim(),
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        ice: formData.ice || undefined,
      });
      onSave(client);
      toast({ 
        title: 'Client modifié avec succès',
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
          <DialogTitle>Modifier le Client</DialogTitle>
          <DialogDescription>
            Modifiez les informations du client
          </DialogDescription>
        </DialogHeader>
        {loadingClient ? (
          <div className="py-8 text-center text-muted-foreground">Chargement...</div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="editClientName">Nom *</Label>
                <Input
                  id="editClientName"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="editClientPhone">Téléphone</Label>
                <Input
                  id="editClientPhone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="editClientAddress">Adresse</Label>
                <Input
                  id="editClientAddress"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData({ ...formData, address: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="editClientIce">ICE (15 caractères max)</Label>
                <Input
                  id="editClientIce"
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
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

