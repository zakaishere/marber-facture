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
import { updateCategory, getCategory, Category } from '@/api/categories';
import { useToast } from '@/hooks/use-toast';

interface EditCategoryDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  categoryId: string | null;
  onSave: (category: Category) => void;
}

export const EditCategoryDialog = ({
  isOpen,
  onOpenChange,
  categoryId,
  onSave,
}: EditCategoryDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCategory, setLoadingCategory] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
  });

  useEffect(() => {
    if (isOpen && categoryId) {
      loadCategory();
    } else if (!isOpen) {
      // Reset form when dialog closes
      setFormData({
        name: '',
      });
    }
  }, [isOpen, categoryId]);

  const loadCategory = async () => {
    if (!categoryId) return;
    try {
      setLoadingCategory(true);
      const category = await getCategory(categoryId);
      setFormData({
        name: category.name,
      });
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message || 'Erreur lors du chargement',
        variant: 'destructive',
      });
      onOpenChange(false);
    } finally {
      setLoadingCategory(false);
    }
  };

  const handleSubmit = async () => {
    if (!categoryId) return;
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
      const category = await updateCategory(categoryId, {
        name: formData.name.trim(),
      });
      onSave(category);
      toast({ 
        title: 'Catégorie modifiée avec succès',
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
          <DialogTitle>Modifier la Catégorie</DialogTitle>
          <DialogDescription>
            Modifiez le nom de la catégorie
          </DialogDescription>
        </DialogHeader>
        {loadingCategory ? (
          <div className="py-8 text-center text-muted-foreground">Chargement...</div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="editCategoryName">Nom *</Label>
                <Input
                  id="editCategoryName"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
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

