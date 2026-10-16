import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createCategory, updateCategory, getCategory } from '@/api/categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';

const CategoryForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
  });

  useEffect(() => {
    if (isEdit && id) {
      loadCategory();
    }
  }, [id]);

  const loadCategory = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const category = await getCategory(id);
      setFormData({
        name: category.name,
      });
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message || 'Erreur lors du chargement',
        variant: 'destructive',
      });
      navigate('/categories');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const data = {
        name: formData.name.trim(),
      };

      if (isEdit && id) {
        await updateCategory(id, data);
        toast({ title: 'Catégorie modifiée avec succès' });
      } else {
        await createCategory(data);
        toast({ title: 'Catégorie créée avec succès' });
      }
      navigate('/categories');
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message || 'Erreur lors de l\'enregistrement',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading && isEdit) return <LoadingSpinner />;

  return (
    <div className="p-8">
      <Button
        variant="ghost"
        onClick={() => navigate('/categories')}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour
      </Button>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            {isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nom *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                maxLength={100}
                placeholder="Ex: Électronique, Alimentaire, etc."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Le nom de la catégorie doit être unique
              </p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/categories')}
              >
                Annuler
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CategoryForm;

