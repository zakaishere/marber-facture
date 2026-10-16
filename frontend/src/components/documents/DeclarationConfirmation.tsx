import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

export type DeclarationStatus = 'DECLARED' | 'NOT_DECLARED';
const label = (status: DeclarationStatus) => status === 'DECLARED' ? 'Déclarée' : 'Non déclarée';

export default function DeclarationConfirmation({ open, code, current, next, busy = false, error, onCancel, onConfirm }: {
  open: boolean; code?: string; current: DeclarationStatus; next: DeclarationStatus;
  busy?: boolean; error?: string; onCancel: () => void; onConfirm: () => void;
}) {
  return <AlertDialog open={open} onOpenChange={value => { if (!value && !busy) onCancel(); }}>
    <AlertDialogContent aria-busy={busy}><AlertDialogHeader><AlertDialogTitle>Confirmer le changement de déclaration</AlertDialogTitle><AlertDialogDescription>
      {code ? `Facture n° ${code}` : 'Cette facture'} : passer du statut « {label(current)} » au statut « {label(next)} » ?
    </AlertDialogDescription></AlertDialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <AlertDialogFooter><AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel><Button type="button" disabled={busy} onClick={onConfirm}>{busy ? 'Enregistrement…' : 'Confirmer le changement'}</Button></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
