import { useEffect, useState } from 'react';
import http from '@/api/http';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
type Account = { id: string; username: string; enabled: boolean; role: string };
export default function InvoicingAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]); const [loading, setLoading] = useState(true);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null); const [username, setUsername] = useState(''); const [password, setPassword] = useState(''); const [enabled, setEnabled] = useState(true);
  async function load() { const response = await http.get<Account[]>('/auth/accounts'); setAccounts(response.data); }
  useEffect(() => { void load().catch(() => setError('Chargement des comptes impossible.')).finally(() => setLoading(false)); }, []);
  function edit(account: Account | null) { setEditing(account); setUsername(account?.username || ''); setPassword(''); setEnabled(account?.enabled ?? true); setError(''); setOpen(true); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { const body = { username: username.trim(), enabled, ...(!editing || password ? { password } : {}) }; if (editing) await http.put(`/auth/accounts/${editing.id}`, body); else await http.post('/auth/accounts', body); setPassword(''); await load(); setOpen(false); }
    catch (cause: unknown) { const e = cause as { response?: { data?: { message?: string } } }; setError(e.response?.data?.message || 'Enregistrement impossible.'); }
    finally { setBusy(false); }
  }
  return <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6"><div className="flex flex-wrap justify-between gap-4"><div><p className="stone-kicker">Administration</p><h1 className="text-3xl mt-1">Comptes de facturation</h1><p className="text-sm text-muted-foreground mt-2">Ces comptes peuvent créer des factures, consulter et imprimer toutes les factures. Aucun accès aux achats, règlements, paramètres ou à la gestion du stock.</p></div><Button onClick={() => edit(null)}>Créer un compte</Button></div>
    {error && !open && <p role="alert" className="text-destructive">{error}</p>}
    <div className="rounded-xl border bg-card overflow-x-auto"><table className="mobile-record-table w-full text-sm"><thead><tr className="border-b text-left"><th className="p-4">Identifiant</th><th>Rôle</th><th>État</th><th /></tr></thead><tbody>{accounts.map(account => <tr key={account.id} className="border-b"><td data-label="Identifiant" className="p-4 font-medium">{account.username}</td><td data-label="Rôle">Facturation</td><td data-label="État">{account.enabled ? 'Actif' : 'Désactivé'}</td><td data-label="Actions" className="p-3 text-right"><Button variant="outline" onClick={() => edit(account)}>Gérer</Button></td></tr>)}</tbody></table>{!accounts.length && <p className="p-8 text-center text-muted-foreground">{loading ? 'Chargement…' : 'Aucun compte de facturation. Créez le premier compte.'}</p>}</div>
    <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); if (!value) setPassword(''); } }}><DialogContent><DialogHeader><DialogTitle>{editing ? 'Gérer le compte' : 'Créer un compte de facturation'}</DialogTitle><DialogDescription>Rôle fixe : Facturation. Toute modification déconnecte les sessions existantes. Les factures sont conservées après désactivation.</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4"><div className="space-y-2"><Label htmlFor="account-username">Identifiant</Label><Input id="account-username" required minLength={3} maxLength={50} pattern="[A-Za-z0-9._\-]+" autoComplete="off" disabled={busy} value={username} onChange={event => setUsername(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="account-password">{editing ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe'}</Label><Input id="account-password" type="password" required={!editing} minLength={10} maxLength={72} autoComplete="new-password" disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /><p className="text-xs text-muted-foreground">Au moins 10 caractères. {editing && 'Laissez vide pour conserver le mot de passe actuel.'}</p></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={enabled} disabled={busy} onChange={event => setEnabled(event.target.checked)} />Compte actif</label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-3"><Button type="button" variant="outline" disabled={busy} onClick={() => { setPassword(''); setOpen(false); }}>Annuler</Button><Button disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button></div></form></DialogContent></Dialog>
  </div>;
}
