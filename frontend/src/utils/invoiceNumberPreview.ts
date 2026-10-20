/** Only an active date request may update the editor, even if cancellation is ignored by the transport. */
export async function loadInvoiceNumberPreview(
  load: () => Promise<string>,
  signal: AbortSignal,
  onSuccess: (code: string) => void,
  onFailure: () => void,
) {
  try {
    const code = await load();
    if (!signal.aborted) onSuccess(code);
  } catch {
    if (!signal.aborted) onFailure();
  }
}

export function sameInvoiceMonth(first: string, second: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(first) && /^\d{4}-\d{2}-\d{2}$/.test(second) && first.slice(0, 7) === second.slice(0, 7);
}
