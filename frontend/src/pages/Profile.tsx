/**
 * Profile Settings Page
 * Allows users to update their profile and company information
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateProfile } from '@/api/auth';
import http from '@/api/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Building2, Lock, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Profile() {
  const { user, checkAuth } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [localFile, setLocalFile] = useState(false);
  useEffect(() => { http.get('/health').then(r => setLocalFile(r.data.storage === 'persistent' && r.data.databaseEngine === 'H2')).catch(() => setLocalFile(false)); }, []);
  async function downloadBackup() {
    setBackingUp(true);
    try {
      const response = await http.post('/auth/local-data/backup', {}, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);const link = document.createElement('a');
      link.href = url;link.download = `marble-local-${new Date().toISOString().slice(0, 10)}.zip`;document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast({ title: 'Sauvegarde créée', description: 'Conservez une copie du fichier ZIP sur un autre support.' });
    } catch { toast({ title: 'Sauvegarde impossible', description: 'Vérifiez que le serveur local est disponible et réessayez.', variant: 'destructive' }); }
    finally { setBackingUp(false); }
  }

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    company_name: '',
    company_activity: '',
    company_address: '',
    company_phone_fix: '',
    company_phone_mobile: '',
    company_email: '',
    company_rc: '',
    company_if: '',
    company_patente: '',
    company_cnss: '',
    company_ice: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        password: '',
        confirmPassword: '',
        company_name: user.company?.name || '',
        company_activity: user.company?.activity || '',
        company_address: user.company?.address || '',
        company_phone_fix: user.company?.phone_fix || '',
        company_phone_mobile: user.company?.phone_mobile || '',
        company_email: user.company?.email || '',
        company_rc: user.company?.rc || '',
        company_if: user.company?.if || '',
        company_patente: user.company?.patente || '',
        company_cnss: user.company?.cnss || '',
        company_ice: user.company?.ice || '',
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate password if provided
      if (formData.password) {
        if (formData.password.length < 6) {
          toast({
            title: 'Erreur',
            description: 'Le mot de passe doit contenir au moins 6 caractères',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
        if (formData.password !== formData.confirmPassword) {
          toast({
            title: 'Erreur',
            description: 'Les mots de passe ne correspondent pas',
            variant: 'destructive',
          });
          setSaving(false);
          return;
        }
      }

      // Prepare update data (exclude empty password and confirmPassword)
      const updateData: any = {
        username: formData.username,
        company_name: formData.company_name,
        company_activity: formData.company_activity,
        company_address: formData.company_address,
        company_phone_fix: formData.company_phone_fix,
        company_phone_mobile: formData.company_phone_mobile,
        company_email: formData.company_email,
        company_rc: formData.company_rc,
        company_if: formData.company_if,
        company_patente: formData.company_patente,
        company_cnss: formData.company_cnss,
        company_ice: formData.company_ice,
      };

      // Only include password if it's provided
      if (formData.password) {
        updateData.password = formData.password;
      }

      const response = await updateProfile(updateData);

      // Refresh auth context
      await checkAuth();

      // Clear password fields
      setFormData((prev) => ({ ...prev, password: '', confirmPassword: '' }));

      toast({
        title: 'Succès',
        description: 'Profil mis à jour avec succès',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.message || 'Erreur lors de la mise à jour du profil',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Paramètres du profil</h1>
        <p className="text-muted-foreground mt-2">
          Gérez vos informations personnelles et les informations de votre entreprise
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* User Information */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5" />
              <CardTitle>Informations utilisateur</CardTitle>
            </div>
            <CardDescription>
              Modifiez votre nom d'utilisateur et votre mot de passe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nom d'utilisateur</Label>
              <Input
                id="username"
                  maxLength={50}
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                disabled={saving}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <Input
                  id="password"
                  maxLength={72}
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Laisser vide pour ne pas changer"
                  disabled={saving}
                />
                <p className="text-sm text-muted-foreground">
                  Laisser vide si vous ne souhaitez pas changer le mot de passe
                </p>
              </div>

              {formData.password && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Company Information */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <CardTitle>Informations de l'entreprise</CardTitle>
            </div>
            <CardDescription>
              Téléphone, adresse, ICE, IF, RC et autres coordonnées utilisés sur vos nouveaux documents. Les documents déjà enregistrés conservent leurs informations d’origine.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nom de l'entreprise</Label>
                <Input
                  id="company_name"
                  maxLength={200}
                  name="company_name"
                  value={formData.company_name}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_activity">Activité</Label>
                <Input
                  id="company_activity"
                  maxLength={255}
                  name="company_activity"
                  value={formData.company_activity}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_address">Adresse</Label>
              <Input
                id="company_address"
                  maxLength={2000}
                name="company_address"
                value={formData.company_address}
                onChange={handleChange}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_phone_fix">Téléphone fixe</Label>
                <Input
                  id="company_phone_fix"
                  maxLength={20}
                  name="company_phone_fix"
                  value={formData.company_phone_fix}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_phone_mobile">Téléphone mobile</Label>
                <Input
                  id="company_phone_mobile"
                  maxLength={20}
                  name="company_phone_mobile"
                  value={formData.company_phone_mobile}
                  onChange={handleChange}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_email">Email</Label>
              <Input
                id="company_email"
                  maxLength={255}
                name="company_email"
                type="email"
                value={formData.company_email}
                onChange={handleChange}
                disabled={saving}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Informations légales</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company_rc">R.C (Registre de Commerce)</Label>
                  <Input
                    id="company_rc"
                  maxLength={50}
                    name="company_rc"
                    value={formData.company_rc}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_if">I.F (Identifiant Fiscal)</Label>
                  <Input
                    id="company_if"
                  maxLength={50}
                    name="company_if"
                    value={formData.company_if}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_patente">Patente</Label>
                  <Input
                    id="company_patente"
                  maxLength={50}
                    name="company_patente"
                    value={formData.company_patente}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company_cnss">C.N.S.S</Label>
                  <Input
                    id="company_cnss"
                  maxLength={50}
                    name="company_cnss"
                    value={formData.company_cnss}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="company_ice">I.C.E (Identifiant Commun de l'Entreprise)</Label>
                  <Input
                    id="company_ice"
                  maxLength={15}
                    name="company_ice"
                    value={formData.company_ice}
                    onChange={handleChange}
                    disabled={saving}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="submit"
            disabled={saving}
            className="min-w-[120px]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Enregistrer
              </>
            )}
          </Button>
        </div>
      </form>
      {localFile && <Card className="mt-6"><CardHeader><CardTitle>Sauvegarde de vos données</CardTitle><CardDescription>Vos données sont conservées dans une base locale permanente, même après l'arrêt de l'application.</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground mb-4">La sauvegarde contient les clients, articles, documents, paiements et paramètres. Gardez aussi une copie privée de votre configuration. La restauration se vérifie dans un dossier séparé pour protéger la base actuelle.</p><Button type="button" disabled={backingUp} onClick={downloadBackup}>{backingUp ? 'Création de la sauvegarde…' : 'Télécharger une sauvegarde ZIP'}</Button></CardContent></Card>}
    </div>
  );
}

