import { useState, type FormEvent } from 'react';
import StoneBrand from './StoneBrand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

export default function LoginForm({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState(''); const [password, setPassword] = useState('');
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (loading) return; setError(''); setLoading(true);
    const values = new FormData(event.currentTarget);
    try { await onLogin(String(values.get('username') || '').trim(), String(values.get('password') || '')); }
    catch (cause: unknown) {
      const message = cause instanceof Error ? cause.message : '';
      setError(/Invalid username or password/i.test(message) ? "Nom d'utilisateur ou mot de passe incorrect." : /Network Error|fetch|serveur/i.test(message) ? 'Serveur inaccessible. Vérifiez votre connexion et réessayez.' : 'Connexion impossible. Vérifiez vos identifiants et réessayez.');
    } finally { setLoading(false); }
  }
  return <main className="stone-login"><div className="stone-login-content">
    <div className="stone-login-brand"><StoneBrand light /></div>
    <header className="stone-login-heading"><h1>Connexion</h1><p>Gestion commerciale & facturation</p></header>
    <Card className="stone-login-card"><CardHeader className="pb-6 px-7 pt-7 sm:px-8"><CardTitle className="text-2xl">Bienvenue</CardTitle><CardDescription className="mt-2">Connectez-vous pour accéder à votre espace.</CardDescription></CardHeader>
      <CardContent className="px-7 pb-7 sm:px-8"><form onSubmit={submit} className="space-y-6">
        {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
        <div className="space-y-2"><Label htmlFor="username">Nom d'utilisateur</Label><Input id="username" name="username" placeholder="Entrez votre nom d'utilisateur" value={username} onChange={event => setUsername(event.target.value)} required autoComplete="username" disabled={loading} /></div>
        <div className="space-y-2"><Label htmlFor="password">Mot de passe</Label><Input id="password" name="password" type="password" placeholder="Entrez votre mot de passe" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" disabled={loading} /></div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connexion en cours…</> : 'Se connecter'}</Button>
      </form></CardContent>
    </Card>
  </div></main>;
}
