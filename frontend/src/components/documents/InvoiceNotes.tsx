import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import http from '@/api/http';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function InvoiceNotes({ invoiceId, notes, onSaved }: { invoiceId: string; notes?: string | null; onSaved: (value: string | null) => void }) {
  const [draft, setDraft] = useState(notes || ''); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(''); const [saved, setSaved] = useState(false);
  useEffect(() => { setDraft(notes || ''); setError(''); }, [invoiceId, notes]);
  useEffect(() => { setSaved(false); }, [invoiceId]);
  const dirty = draft !== (notes || '');
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (saving || !dirty) return; setSaving(true); setError(''); setSaved(false);
    try {
      const response = await http.patch<{ notes: string | null }>(`/factures/${invoiceId}/notes`, { notes: draft });
      setDraft(response.data.notes || ''); onSaved(response.data.notes); setSaved(true);
    } catch (cause: unknown) { const failure = cause as { response?: { data?: { message?: string } } }; setError(failure.response?.data?.message || 'Impossible d’enregistrer la note. Votre texte est conservé ; réessayez.'); }
    finally { setSaving(false); }
  }
  return <Card><CardContent className="pt-5"><form onSubmit={save} className="space-y-3">
    <div><Label htmlFor="saved-invoice-notes" className="font-semibold text-base">Notes internes</Label><p id="saved-invoice-notes-help" className="text-xs text-muted-foreground mt-1">Ajoutez ou modifiez une note sur cette facture. Elle ne sera ni imprimée ni incluse dans le PDF.</p></div>
    <Textarea id="saved-invoice-notes" value={draft} maxLength={4000} rows={4} disabled={saving} aria-describedby="saved-invoice-notes-help" onChange={event => { setDraft(event.target.value); setSaved(false); setError(''); }} placeholder="Écrivez une note concernant cette facture…" />
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="text-xs text-muted-foreground"><span>{draft.length} / 4 000 caractères</span>{dirty && <span className="ml-3">Modifications non enregistrées</span>}{saved && !dirty && <span role="status" className="ml-3 text-green-800">Note enregistrée</span>}</div><Button type="submit" disabled={saving || !dirty}><Save size={15} className="mr-2" />{saving ? 'Enregistrement…' : 'Enregistrer la note'}</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form></CardContent></Card>;
}
