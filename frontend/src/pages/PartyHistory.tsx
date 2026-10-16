import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileText, Plus } from 'lucide-react';
import http from '@/api/http';
import type { MarbleDocument, Party } from '@/models/document';
import { formatCurrency } from '@/utils/tva';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function PartyHistory({ supplier = false }: { supplier?: boolean }) {
  const { id } = useParams(); const resource = supplier ? '/suppliers' : '/clients'; const base = supplier ? '/bon-achat' : '/factures';
  const [page, setPage] = useState(1); const [total, setTotal] = useState(0); const [summary, setSummary] = useState({ totalAmount: 0, paidAmount: 0, remainingAmount: 0 });
  const [party, setParty] = useState<Party | null>(null); const [docs, setDocs] = useState<MarbleDocument[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  useEffect(() => { setPage(1); }, [id, supplier]);
  useEffect(() => {
    let active = true;setLoading(true);setError('');
    Promise.all([http.get<Party>(`${resource}/${id}`), http.get(`${resource}/${id}/documents`, { params: { paged: true, page, pageSize: 50 } })])
      .then(([p, d]) => { if (!active) return;setParty(p.data);
        if (Array.isArray(d.data)) {
          const all: MarbleDocument[] = d.data; const activeDocs = all.filter(doc => doc.status !== 'CANCELLED');
          const sum = (key: 'totalAmount' | 'totalTtc' | 'paidAmount' | 'remainingAmount') => activeDocs.reduce((n, doc) => n + Math.round(Number(doc[key] || 0) * 100), 0) / 100;
          setDocs(all.slice((page - 1) * 50, page * 50));setTotal(all.length);setSummary({ totalAmount: sum(supplier ? 'totalAmount' : 'totalTtc'), paidAmount: sum('paidAmount'), remainingAmount: sum('remainingAmount') });
        } else { setDocs(d.data.data);setTotal(d.data.total);setSummary(d.data.summary); } })
      .catch(e => { if (active) setError(e.response?.data?.message || 'Chargement impossible.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [resource, id, page, supplier]);
  if (loading) return <LoadingSpinner />;
  if (error) return <p role="alert" className="p-8 text-destructive">{error}</p>;
  return <div className="p-4 lg:p-8 max-w-[1400px] mx-auto space-y-6"><Link to={resource} className="inline-flex gap-2 text-sm text-muted-foreground"><ArrowLeft size={16} />Retour aux {supplier ? 'fournisseurs' : 'clients'}</Link>{error && <p role="alert" className="text-destructive">{error}</p>}<div className="flex flex-wrap gap-4 justify-between"><div><p className="stone-kicker">Historique {supplier ? 'fournisseur' : 'client'}</p><h1 className="text-3xl font-semibold mt-1">{party?.name}</h1><p className="text-muted-foreground mt-2">{[party?.phone, party?.address].filter(Boolean).join(' · ')}</p></div><Button asChild><Link to={`${base}/new`}><Plus size={16} className="mr-2" />{supplier ? "Bon d'achat" : 'Nouvelle facture'}</Link></Button></div>
    <div className="grid md:grid-cols-3 gap-4">{[[supplier ? 'Total commandé TTC' : 'Total facturé TTC', summary.totalAmount], ['Montant payé', summary.paidAmount], ['Reste à payer', summary.remainingAmount]].map(([label, value]) => <Card key={String(label)}><CardContent className="pt-5"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-2xl font-semibold mt-3">{formatCurrency(Number(value))}</p></CardContent></Card>)}</div>
    <Card className="overflow-hidden"><div className="p-5 border-b flex gap-2 items-center font-semibold"><FileText size={18} />Documents</div><div className="overflow-x-auto"><table className="mobile-record-table w-full text-sm text-left"><thead className="table-header-bg"><tr>{['Numéro', 'Date', 'Total TTC', 'Payé', 'Reste', ''].map((label, i) => <th key={i} className="p-4">{label}</th>)}</tr></thead><tbody>{docs.map(doc => <tr key={doc.id} className="border-t"><td data-label="Numéro" className="p-4 font-semibold text-primary">{doc.code}</td><td data-label="Date" className="p-4">{doc.date}</td><td data-label="Total TTC" className="p-4">{formatCurrency(Number(supplier ? doc.totalAmount : doc.totalTtc))}</td><td data-label="Payé" className="p-4">{formatCurrency(Number(doc.paidAmount))}</td><td data-label="Reste" className="p-4">{formatCurrency(Number(doc.remainingAmount))}</td><td data-label="Actions" className="p-4"><Button variant="outline" size="sm" asChild><Link to={`${base}/${doc.id}`}>Consulter</Link></Button></td></tr>)}</tbody></table>{!docs.length && <p className="p-10 text-center text-muted-foreground">Aucun document pour ce contact.</p>}</div></Card>
    <div className="flex justify-between items-center gap-3 text-sm"><span>{total} documents · Page {page} / {Math.max(1, Math.ceil(total / 50))}</span><div className="flex gap-2"><Button variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Précédent</Button><Button variant="outline" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Suivant</Button></div></div>
    {supplier && <p className="text-xs text-muted-foreground">Les montants concernent les bons d'achat enregistrés, hors bons annulés. Ils ne constituent pas un relevé de factures fournisseurs.</p>}
  </div>;
}
