import DeclarationConfirmation from '@/components/documents/DeclarationConfirmation';
import { useEffect, useState, useRef, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReactToPrint } from 'react-to-print';
import { getFactures, deleteFacture, updateFacture, Facture } from '@/api/factures';
import {
  Plus, Eye, Trash2, ChevronLeft, ChevronRight, Printer,
  ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft,
  X, RotateCcw, Loader2, Search, Calendar,
  Banknote, FileText, Building2, ArrowLeftRight, FileX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationEllipsis,
} from '@/components/ui/pagination';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
  SheetFooter,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/utils/tva';
import { FacturePreview } from '@/components/factures/FacturePreview';
import { convertFactureToPrintModel } from '@/utils/facturePrintConverter';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
type StatusFilter = 'ALL' | 'DECLARED' | 'NOT_DECLARED';
type PaymentValue = 'ESPECE' | 'CHEQUE' | 'LCN' | 'VIREMENT';
type SortField = 'code' | 'date' | 'totalTtc' | 'totalHt' | 'totalTva' | 'status' | 'paymentMethod' | 'client';

// ─── Debounce ────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState<T>(value);
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return d;
}

// ─── Search highlight ────────────────────────────────────────────────────────
function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || !text) return <span>{text}</span>;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 text-yellow-900 font-semibold rounded-[2px] px-0.5 not-italic">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

// ─── Payment config ───────────────────────────────────────────────────────────
const PAYMENT_CONFIG: Record<PaymentValue, { label: string; Icon: React.ElementType }> = {
  ESPECE:   { label: 'Espèce',   Icon: Banknote },
  CHEQUE:   { label: 'Chèque',   Icon: FileText },
  LCN:      { label: 'LCN',      Icon: Building2 },
  VIREMENT: { label: 'Virement', Icon: ArrowLeftRight },
};
const PAYMENT_VALUES: PaymentValue[] = ['ESPECE', 'CHEQUE', 'LCN', 'VIREMENT'];

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, onClick, loading }: { status: 'DECLARED' | 'NOT_DECLARED'; onClick?: () => void; loading?: boolean }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium transition-opacity';
  const dim  = loading ? 'opacity-50 pointer-events-none' : onClick ? 'cursor-pointer hover:opacity-75' : '';
  const text = status === 'DECLARED' ? 'Déclarée' : 'Non déclarée';
  const style = `${base} ${status === 'DECLARED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'} ${dim}`;
  return onClick ? <button type="button" className={style} disabled={loading} onClick={onClick} aria-label={`Changer le statut : ${text}`}>{text}</button> : <span className={style}>{text}</span>;
}

// ─── Pill toggle (no portal) ──────────────────────────────────────────────────
function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-colors duration-100 whitespace-nowrap',
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
          : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground bg-background'
      )}
    >
      {children}
    </button>
  );
}

// ─── Input with left icon ─────────────────────────────────────────────────────
function DateInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-0">
      <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
      <Input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="pl-8 h-8 text-xs"
        placeholder={placeholder}
      />
    </div>
  );
}

// ─── Number input with DH suffix ──────────────────────────────────────────────
function DhInput({ value, onChange, placeholder, error }: { value: string; onChange: (v: string) => void; placeholder: string; error?: boolean }) {
  return (
    <div className="relative flex-1 min-w-0">
      <Input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        min={0}
        className={cn('h-8 text-xs pr-8', error && 'border-destructive focus-visible:ring-destructive')}
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">DH</span>
    </div>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ITEMS_PER_PAGE = 50;
const VALID_PAYMENTS = new Set<string>(PAYMENT_VALUES);
const VALID_STATUSES = new Set<string>(['ALL', 'DECLARED', 'NOT_DECLARED']);

// ─────────────────────────────────────────────────────────────────────────────
const FacturesPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();

  // ── Init filter state from URL ────────────────────────────────────────────
  const [search, setSearch]           = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const v = searchParams.get('status') ?? 'ALL';
    return VALID_STATUSES.has(v) ? (v as StatusFilter) : 'ALL';
  });
  // Payment stored as sorted comma-separated string for stable deps
  const [paymentStr, setPaymentStr]   = useState(() => searchParams.get('payment') ?? '');
  const [dateFrom, setDateFrom]       = useState(() => searchParams.get('from') ?? '');
  const [dateTo, setDateTo]           = useState(() => searchParams.get('to') ?? '');
  const [minTtc, setMinTtc]           = useState(() => searchParams.get('minTtc') ?? '');
  const [maxTtc, setMaxTtc]           = useState(() => searchParams.get('maxTtc') ?? '');
  const [sortBy, setSortBy]           = useState<SortField>(() => (searchParams.get('sort') as SortField) ?? 'date');
  const [sortOrder, setSortOrder]     = useState<'ASC' | 'DESC'>(() => (searchParams.get('order') as 'ASC' | 'DESC') ?? 'DESC');
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [itemsPerPage, setItemsPerPage] = useState(() => Number(searchParams.get('perPage')) || ITEMS_PER_PAGE);

  // ── Derived payment Set ───────────────────────────────────────────────────
  const paymentFilters = useMemo<Set<PaymentValue>>(() => {
    const vals = paymentStr.split(',').filter((v): v is PaymentValue => VALID_PAYMENTS.has(v));
    return new Set(vals);
  }, [paymentStr]);

  const togglePayment = (value: PaymentValue) => {
    setPaymentStr(prev => {
      const set = new Set(prev.split(',').filter((v): v is PaymentValue => VALID_PAYMENTS.has(v)));
      if (set.has(value)) set.delete(value); else set.add(value);
      return [...set].sort().join(',');
    });
  };
  const clearPayment = () => setPaymentStr('');

  // ── Debounced values for API ───────────────────────────────────────────────
  const debouncedSearch   = useDebounce(search, 300);
  const debouncedMinTtc   = useDebounce(minTtc, 400);
  const debouncedMaxTtc   = useDebounce(maxTtc, 400);

  // ── TTC validation ────────────────────────────────────────────────────────
  const ttcError = !!(debouncedMinTtc && debouncedMaxTtc && Number(debouncedMinTtc) > Number(debouncedMaxTtc));

  // ── List state ────────────────────────────────────────────────────────────
  const [factures, setFactures]       = useState<Facture[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [totalFactures, setTotalFactures] = useState(0);
  const [declarationTarget, setDeclarationTarget] = useState<Facture | null>(null);
  const [declarationError, setDeclarationError] = useState('');
  const [deleteId, setDeleteId]       = useState<string | null>(null);
  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // ── Batch print ───────────────────────────────────────────────────────────
  const [printFactures, setPrintFactures] = useState<Facture[]>([]);
  const [printLoading, setPrintLoading]   = useState(false);
  const batchPrintRef = useRef<HTMLDivElement>(null);

  const handleBatchPrint = useReactToPrint({
    contentRef: batchPrintRef,
    documentTitle: 'Factures',
    onAfterPrint: () => setPrintFactures([]),
  });

  // ── Sync URL when filters change ──────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams();
    if (debouncedSearch)         p.set('q', debouncedSearch);
    if (statusFilter !== 'ALL')  p.set('status', statusFilter);
    if (paymentStr)              p.set('payment', paymentStr);
    if (dateFrom)                p.set('from', dateFrom);
    if (dateTo)                  p.set('to', dateTo);
    if (debouncedMinTtc)         p.set('minTtc', debouncedMinTtc);
    if (debouncedMaxTtc)         p.set('maxTtc', debouncedMaxTtc);
    if (sortBy !== 'date')       p.set('sort', sortBy);
    if (sortOrder !== 'DESC')    p.set('order', sortOrder);
    if (currentPage > 1)         p.set('page', String(currentPage));
    if (itemsPerPage !== ITEMS_PER_PAGE) p.set('perPage', String(itemsPerPage));
    setSearchParams(p, { replace: true });
  }, [debouncedSearch, statusFilter, paymentStr, dateFrom, dateTo, debouncedMinTtc, debouncedMaxTtc, sortBy, sortOrder, currentPage, itemsPerPage]);

  // ── Reset page when filters change ────────────────────────────────────────
  useEffect(() => { setCurrentPage(1); },
    [debouncedSearch, statusFilter, paymentStr, dateFrom, dateTo, debouncedMinTtc, debouncedMaxTtc]);

  // ── API params builder ────────────────────────────────────────────────────
  const apiFilters = useMemo(() => ({
    search:        debouncedSearch || undefined,
    dateFrom:      dateFrom        || undefined,
    dateTo:        dateTo          || undefined,
    status:        statusFilter !== 'ALL' ? statusFilter : undefined,
    paymentMethod: paymentStr      || undefined,   // comma-separated or single
    minTtc:        (!ttcError && debouncedMinTtc) ? debouncedMinTtc : undefined,
    maxTtc:        (!ttcError && debouncedMaxTtc) ? debouncedMaxTtc : undefined,
    sortBy,
    sortOrder,
  }), [debouncedSearch, dateFrom, dateTo, statusFilter, paymentStr, debouncedMinTtc, debouncedMaxTtc, ttcError, sortBy, sortOrder]);

  // ── Load factures ─────────────────────────────────────────────────────────
  useEffect(() => { loadFactures(); }, [apiFilters, currentPage, itemsPerPage]);

  const loadFactures = async () => {
    try {
      setLoading(true);
      setError('');
      const data: any = await getFactures({ ...apiFilters, page: currentPage, pageSize: itemsPerPage, paged: true });
      if (Array.isArray(data)) {
        setFactures(data);
        setTotalFactures(
          data.length < itemsPerPage
            ? (currentPage - 1) * itemsPerPage + data.length
            : currentPage * itemsPerPage + 1
        );
      } else if (data?.data) {
        setFactures(data.data);
        setTotalFactures(data.total ?? data.data.length);
      } else {
        setFactures([]);
        setTotalFactures(0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erreur lors du chargement');
      setFactures([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintAll = async () => {
    setPrintLoading(true);
    try {
      const data: any = await getFactures({ ...apiFilters, page: currentPage, pageSize: itemsPerPage, includeItems: true });
      const list: Facture[] = Array.isArray(data) ? data : (data?.data ?? []);
      if (!list.length) { toast({ title: 'Aucune facture à imprimer' }); return; }
      // flushSync forces React to synchronously render the preview into the DOM
      // before handleBatchPrint() reads batchPrintRef.current
      flushSync(() => setPrintFactures(list));
      handleBatchPrint();
    } catch {
      toast({ title: 'Erreur', description: 'Impossible de charger les factures.', variant: 'destructive' });
    } finally {
      setPrintLoading(false);
    }
  };

  // ── Sort ──────────────────────────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortBy === field) setSortOrder(o => o === 'ASC' ? 'DESC' : 'ASC');
    else { setSortBy(field); setSortOrder('DESC'); }
  };
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortBy !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-30" />;
    return sortOrder === 'ASC' ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // ── Active filters ────────────────────────────────────────────────────────
  const hasFilters = !!(debouncedSearch || dateFrom || dateTo || statusFilter !== 'ALL' || paymentStr || debouncedMinTtc || debouncedMaxTtc);

  const resetFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo('');
    setStatusFilter('ALL'); setPaymentStr('');
    setMinTtc(''); setMaxTtc('');
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalFactures / itemsPerPage));
  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const renderPaginationItems = () => {
    if (totalPages <= 1) return (
      <PaginationItem><Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>1</Button></PaginationItem>
    );
    const MAX = 5;
    let s = Math.max(1, currentPage - Math.floor(MAX / 2));
    let e = Math.min(totalPages, s + MAX - 1);
    if (e - s < MAX - 1) s = Math.max(1, e - MAX + 1);
    const items = [];
    if (s > 1) {
      items.push(<PaginationItem key={1}><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(1)}>1</Button></PaginationItem>);
      if (s > 2) items.push(<PaginationItem key="es"><PaginationEllipsis /></PaginationItem>);
    }
    for (let i = s; i <= e; i++) {
      items.push(
        <PaginationItem key={i}>
          <Button variant={i === currentPage ? 'outline' : 'ghost'} size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(i)}>{i}</Button>
        </PaginationItem>
      );
    }
    if (e < totalPages) {
      if (e < totalPages - 1) items.push(<PaginationItem key="ee"><PaginationEllipsis /></PaginationItem>);
      items.push(<PaginationItem key={totalPages}><Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(totalPages)}>{totalPages}</Button></PaginationItem>);
    }
    return items;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteFacture(deleteId);
      toast({ title: 'Facture supprimée avec succès' });
      setDeleteId(null);
      loadFactures();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.response?.data?.message || 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const handleToggleStatus = (facture: Facture) => {
    if (togglingId) return;
    setDeclarationError(''); setDeclarationTarget(facture);
  };
  const confirmDeclaration = async () => {
    if (!declarationTarget || togglingId) return;
    const facture = declarationTarget;
    const next = facture.status === 'DECLARED' ? 'NOT_DECLARED' : 'DECLARED';
    setTogglingId(facture.id); setDeclarationError('');
    try {
      await updateFacture(facture.id, { status: next });
      setFactures(previous => previous.map(row => row.id === facture.id ? { ...row, status: next } : row));
      setDeclarationTarget(null);
      toast({ title: next === 'DECLARED' ? 'Facture déclarée' : 'Facture marquée non déclarée' });
      void loadFactures();
    } catch (cause: unknown) {
      const error = cause as { response?: { data?: { message?: string } } };
      setDeclarationError(error.response?.data?.message || 'Impossible de changer le statut. Réessayez.');
    } finally { setTogglingId(null); }
  };

  const pageTotals = useMemo(() => factures.reduce(
    (acc, f) => ({ ht: acc.ht + Number(f.totalHt), tva: acc.tva + Number(f.totalTva), ttc: acc.ttc + Number(f.totalTtc) }),
    { ht: 0, tva: 0, ttc: 0 }
  ), [factures]);

  // ── Filter panel (shared desktop + mobile) ────────────────────────────────
  const FilterPanel = () => (
    <div className="space-y-4">
      {/* Status pills */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Statut</p>
        <div className="flex gap-1.5 flex-wrap">
          <Pill active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>Tous</Pill>
          <Pill active={statusFilter === 'DECLARED'} onClick={() => setStatusFilter('DECLARED')}>Déclarée</Pill>
          <Pill active={statusFilter === 'NOT_DECLARED'} onClick={() => setStatusFilter('NOT_DECLARED')}>Non déclarée</Pill>
        </div>
      </div>

      {/* Payment pills (multi-select) */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Paiement</p>
        <div className="flex gap-1.5 flex-wrap">
          <Pill active={paymentFilters.size === 0} onClick={clearPayment}>Tous</Pill>
          {PAYMENT_VALUES.map(v => {
            const { label, Icon } = PAYMENT_CONFIG[v];
            return (
              <Pill key={v} active={paymentFilters.has(v)} onClick={() => togglePayment(v)}>
                <Icon className="h-3 w-3" />{label}
              </Pill>
            );
          })}
        </div>
      </div>

      {/* Date range */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Période</p>
        <div className="flex items-center gap-2">
          <DateInput value={dateFrom} onChange={setDateFrom} placeholder="Date début" />
          <span className="text-muted-foreground text-xs shrink-0">→</span>
          <DateInput value={dateTo} onChange={setDateTo} placeholder="Date fin" />
        </div>
      </div>

      {/* TTC range */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Total TTC</p>
        <div className="flex items-center gap-2">
          <DhInput value={minTtc} onChange={setMinTtc} placeholder="Min" error={ttcError} />
          <span className="text-muted-foreground text-xs shrink-0">–</span>
          <DhInput value={maxTtc} onChange={setMaxTtc} placeholder="Max" error={ttcError} />
        </div>
        {ttcError && <p className="text-[11px] text-destructive mt-1">Le minimum doit être inférieur au maximum</p>}
      </div>
    </div>
  );

  // ── Chip list ─────────────────────────────────────────────────────────────
  const FilterChips = () => (
    <div className="flex flex-wrap gap-1.5">
      {debouncedSearch && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal h-6 pr-1">
          Recherche : "{debouncedSearch}"
          <button onClick={() => setSearch('')} className="ml-0.5 rounded hover:bg-muted"><X className="h-3 w-3" /></button>
        </Badge>
      )}
      {statusFilter !== 'ALL' && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal h-6 pr-1">
          Statut : {statusFilter === 'DECLARED' ? 'Déclarée' : 'Non déclarée'}
          <button onClick={() => setStatusFilter('ALL')} className="ml-0.5 rounded hover:bg-muted"><X className="h-3 w-3" /></button>
        </Badge>
      )}
      {paymentFilters.size > 0 && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal h-6 pr-1">
          Paiement : {[...paymentFilters].map(v => PAYMENT_CONFIG[v].label).join(', ')}
          <button onClick={clearPayment} className="ml-0.5 rounded hover:bg-muted"><X className="h-3 w-3" /></button>
        </Badge>
      )}
      {(dateFrom || dateTo) && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal h-6 pr-1">
          Période : {dateFrom ? new Date(dateFrom).toLocaleDateString('fr-FR') : '…'} – {dateTo ? new Date(dateTo).toLocaleDateString('fr-FR') : '…'}
          <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="ml-0.5 rounded hover:bg-muted"><X className="h-3 w-3" /></button>
        </Badge>
      )}
      {(debouncedMinTtc || debouncedMaxTtc) && !ttcError && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal h-6 pr-1">
          TTC : {debouncedMinTtc || '0'} – {debouncedMaxTtc || '∞'} DH
          <button onClick={() => { setMinTtc(''); setMaxTtc(''); }} className="ml-0.5 rounded hover:bg-muted"><X className="h-3 w-3" /></button>
        </Badge>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50 lg:bg-background p-4 lg:p-6 w-full max-w-full overflow-x-hidden">

      {/* Hidden batch print container — always in DOM so ref is never null.
          The outer div handles off-screen hiding; batchPrintRef points to the
          inner div so react-to-print doesn't copy the position:absolute/-9999px
          styles into the print iframe (which would blank the output). */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none' }}>
        <div ref={batchPrintRef}>
          {printFactures.map((f, i) => (
            <div key={f.id} style={i < printFactures.length - 1 ? { pageBreakAfter: 'always' } : undefined}>
              <FacturePreview data={convertFactureToPrintModel(f, user)} />
            </div>
          ))}
        </div>
      </div>

      {/* Mobile back */}
      <div className="lg:hidden mb-4">
        <Button variant="ghost" onClick={() => navigate('/')} size="sm" className="h-9 px-3 text-sm">
          <ArrowLeft className="h-4 w-4 mr-2" />Retour au tableau de bord
        </Button>
      </div>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold">Factures</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={handlePrintAll} disabled={printLoading || loading} className="flex-1 sm:flex-none">
            {printLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
            Imprimer cette page
          </Button>
          <Button onClick={() => navigate('/factures/new')} size="sm" className="flex-1 sm:flex-none">
            <Plus className="h-4 w-4 mr-2" />Nouvelle Facture
          </Button>
        </div>
      </div>

      {/* ── Row 1: search + per-page + reset ───────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Code ou nom du client..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 pr-8"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Per-page (desktop) */}
        <div className="hidden lg:block">
          <Select value={String(itemsPerPage)} onValueChange={v => { setItemsPerPage(Number(v)); setCurrentPage(1); }}>
            <SelectTrigger className="h-9 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[25, 50, 100, 200].map(n => <SelectItem key={n} value={String(n)}>{n} par page</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Reset (desktop, only when active) */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="hidden lg:flex h-9 text-xs text-muted-foreground gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" />Réinitialiser
          </Button>
        )}

        {/* Mobile sheet trigger */}
        <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="lg:hidden h-9 relative">
              Filtres
              {hasFilters && (
                <Badge className="absolute -top-1.5 -right-1.5 h-4 w-4 p-0 flex items-center justify-center text-[9px]">
                  {[debouncedSearch, statusFilter !== 'ALL', paymentStr, dateFrom || dateTo, (debouncedMinTtc || debouncedMaxTtc) && !ttcError].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 flex flex-col">
            <SheetHeader>
              <SheetTitle>Filtres</SheetTitle>
              <SheetDescription>Affinez les résultats</SheetDescription>
            </SheetHeader>
            <div className="py-4 flex-1 overflow-y-auto"><FilterPanel /></div>
            <SheetFooter className="gap-2 flex-row border-t pt-4">
              {hasFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters} className="flex-1">
                  <RotateCcw className="h-4 w-4 mr-2" />Réinitialiser
                </Button>
              )}
              <SheetClose asChild>
                <Button size="sm" className="flex-1">Fermer</Button>
              </SheetClose>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* ── Row 2: desktop filter panel ────────────────────────────────────── */}
      <div className="hidden lg:block mb-3 rounded-lg border bg-card px-4 py-3">
        <div className="flex items-start gap-6 flex-wrap">
          {/* Status */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Statut</p>
            <div className="flex gap-1.5">
              <Pill active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>Tous</Pill>
              <Pill active={statusFilter === 'DECLARED'} onClick={() => setStatusFilter('DECLARED')}>Déclarée</Pill>
              <Pill active={statusFilter === 'NOT_DECLARED'} onClick={() => setStatusFilter('NOT_DECLARED')}>Non déclarée</Pill>
            </div>
          </div>

          <Separator orientation="vertical" className="h-auto self-stretch" />

          {/* Payment */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Paiement</p>
            <div className="flex gap-1.5">
              <Pill active={paymentFilters.size === 0} onClick={clearPayment}>Tous</Pill>
              {PAYMENT_VALUES.map(v => {
                const { label, Icon } = PAYMENT_CONFIG[v];
                return (
                  <Pill key={v} active={paymentFilters.has(v)} onClick={() => togglePayment(v)}>
                    <Icon className="h-3 w-3" />{label}
                  </Pill>
                );
              })}
            </div>
          </div>

          <Separator orientation="vertical" className="h-auto self-stretch" />

          {/* Date range */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Période</p>
            <div className="flex items-center gap-2">
              <DateInput value={dateFrom} onChange={setDateFrom} placeholder="Date début" />
              <span className="text-muted-foreground text-xs">→</span>
              <DateInput value={dateTo} onChange={setDateTo} placeholder="Date fin" />
            </div>
          </div>

          <Separator orientation="vertical" className="h-auto self-stretch" />

          {/* TTC range */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Total TTC{ttcError && <span className="text-destructive ml-2 normal-case font-normal">min &gt; max</span>}
            </p>
            <div className="flex items-center gap-2">
              <DhInput value={minTtc} onChange={setMinTtc} placeholder="Min" error={ttcError} />
              <span className="text-muted-foreground text-xs">–</span>
              <DhInput value={maxTtc} onChange={setMaxTtc} placeholder="Max" error={ttcError} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Active filter chips + results count ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 mb-3 min-h-[24px]">
        <div className="flex-1">
          {hasFilters && <FilterChips />}
        </div>
        {!loading && (
          <p className="text-xs text-muted-foreground shrink-0">
            <span className="font-semibold text-foreground">{totalFactures}</span> facture{totalFactures !== 1 ? 's' : ''} trouvée{totalFactures !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <>
          {/* ── Desktop table ───────────────────────────────────────────────── */}
          <div className="hidden lg:block border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="w-full table-auto">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    {(
                      [
                        { field: 'code',          label: 'Code',      right: false },
                        { field: 'date',          label: 'Date',      right: false },
                        { field: 'client',        label: 'Client',    right: false },
                        { field: 'status',        label: 'Statut',    right: false },
                        { field: 'paymentMethod', label: 'Paiement',  right: false },
                        { field: 'totalHt',       label: 'Total HT',  right: true },
                        { field: 'totalTva',      label: 'Total TVA', right: true },
                        { field: 'totalTtc',      label: 'Total TTC', right: true },
                      ] as const
                    ).map(({ field, label, right }) => (
                      <TableHead
                        key={field}
                        className={cn('h-9 px-3 text-xs font-semibold cursor-pointer hover:bg-muted/70 select-none', right && 'text-right')}
                        onClick={() => handleSort(field)}
                      >
                        <div className={cn('flex items-center', right && 'justify-end')}>
                          {label}<SortIcon field={field} />
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="h-9 px-3 text-xs font-semibold text-right w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factures.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-16">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <FileX className="h-12 w-12 opacity-20" />
                          <p className="text-sm font-medium">Aucune facture ne correspond à vos critères</p>
                          {hasFilters && (
                            <Button variant="outline" size="sm" onClick={resetFilters} className="mt-1">
                              <RotateCcw className="h-3.5 w-3.5 mr-2" />Réinitialiser les filtres
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : factures.map(f => {
                    const payConf = f.paymentMethod ? PAYMENT_CONFIG[f.paymentMethod as PaymentValue] : null;
                    return (
                      <TableRow key={f.id} className="hover:bg-muted/30">
                        <TableCell className="px-3 py-2 text-xs font-mono font-medium">
                          <Highlight text={f.code} query={debouncedSearch} />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(f.date).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <Highlight text={f.client?.name ?? '-'} query={debouncedSearch} />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <StatusBadge status={f.status} onClick={() => handleToggleStatus(f)} loading={togglingId === f.id} />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          {payConf ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <payConf.Icon className="h-3.5 w-3.5 shrink-0" />
                              {payConf.label}
                            </span>
                          ) : <span className="text-xs text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-right tabular-nums text-muted-foreground">{formatCurrency(f.totalHt)}</TableCell>
                        <TableCell className="px-3 py-2 text-xs text-right tabular-nums text-muted-foreground">{formatCurrency(f.totalTva)}</TableCell>
                        <TableCell className="px-3 py-2 text-xs text-right tabular-nums font-semibold">{formatCurrency(f.totalTtc)}</TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/factures/${f.id}`)} title="Voir">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/factures/${f.id}?print=true`)} title="Imprimer">
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(f.id)} title="Supprimer">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Page sub-totals */}
            {factures.length > 0 && (
              <div className="flex justify-end items-center gap-5 px-4 py-2 bg-muted/30 border-t text-xs">
                <span className="text-muted-foreground">Sous-total (page)</span>
                <span className="tabular-nums">HT : <strong>{formatCurrency(pageTotals.ht)}</strong></span>
                <span className="tabular-nums">TVA : <strong>{formatCurrency(pageTotals.tva)}</strong></span>
                <span className="tabular-nums font-bold text-primary">TTC : {formatCurrency(pageTotals.ttc)}</span>
              </div>
            )}
          </div>

          {/* ── Mobile cards ─────────────────────────────────────────────────── */}
          <div className="lg:hidden">
            {factures.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground bg-white rounded-xl shadow-sm">
                <FileX className="h-12 w-12 opacity-20" />
                <p className="text-sm font-medium">Aucune facture ne correspond à vos critères</p>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />Réinitialiser les filtres
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {factures.map(f => {
                  const payConf = f.paymentMethod ? PAYMENT_CONFIG[f.paymentMethod as PaymentValue] : null;
                  return (
                    <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-xs text-muted-foreground">{new Date(f.date).toLocaleDateString('fr-FR')}</div>
                          <div className="font-bold font-mono">{f.code}</div>
                        </div>
                        <StatusBadge status={f.status} onClick={() => handleToggleStatus(f)} loading={togglingId === f.id} />
                      </div>
                      <div className="mb-3 pb-3 border-b">
                        <div className="font-semibold text-sm">{f.client?.name || '—'}</div>
                        {payConf && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <payConf.Icon className="h-3.5 w-3.5" />{payConf.label}
                          </div>
                        )}
                      </div>
                      <div className="space-y-1 text-sm mb-4">
                        <div className="flex justify-between"><span className="text-muted-foreground">HT</span><span className="tabular-nums">{formatCurrency(f.totalHt)}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">TVA</span><span className="tabular-nums">{formatCurrency(f.totalTva)}</span></div>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t">
                          <span className="font-semibold">TTC</span>
                          <span className="text-lg font-bold text-primary tabular-nums">{formatCurrency(f.totalTtc)}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => navigate(`/factures/${f.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />Voir
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => navigate(`/factures/${f.id}?print=true`)}>
                          <Printer className="h-4 w-4 mr-2" />Imprimer
                        </Button>
                        <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-destructive border-destructive/20" onClick={() => setDeleteId(f.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Pagination ───────────────────────────────────────────────────── */}
          {totalFactures > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalFactures)} sur {totalFactures}
              </p>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <Button variant="ghost" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="gap-1">
                      <ChevronLeft className="h-4 w-4" /><span>Précédent</span>
                    </Button>
                  </PaginationItem>
                  {renderPaginationItems()}
                  <PaginationItem>
                    <Button variant="ghost" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="gap-1">
                      <span>Suivant</span><ChevronRight className="h-4 w-4" />
                    </Button>
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </>
      )}

      <DeclarationConfirmation open={!!declarationTarget} code={declarationTarget?.code} current={declarationTarget?.status || 'NOT_DECLARED'} next={declarationTarget?.status === 'DECLARED' ? 'NOT_DECLARED' : 'DECLARED'} busy={!!togglingId} error={declarationError} onCancel={() => { setDeclarationTarget(null); setDeclarationError(''); }} onConfirm={() => void confirmDeclaration()} />
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FacturesPage;
