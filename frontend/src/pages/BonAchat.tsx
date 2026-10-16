import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getBonAchats, deleteBonAchat, BonAchat, BonAchatStatus, BonPaymentMethod } from '@/api/bonAchat';
import {
  Plus, Eye, Trash2, ChevronLeft, ChevronRight, Printer,
  ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft,
  X, RotateCcw, Search, Calendar,
  Banknote, FileText, Building2, CreditCard, FileX,
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
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
type SortField = 'code' | 'date' | 'totalAmount' | 'status' | 'paymentMethod' | 'supplier';

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

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<BonAchatStatus, { label: string; className: string }> = {
  PENDING:   { label: 'En cours',  className: 'bg-amber-100 text-amber-800' },
  COMPLETED: { label: 'Terminé',   className: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Annulé',    className: 'bg-red-100 text-red-800' },
};

function StatusBadge({ status }: { status: BonAchatStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.PENDING;
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium', cfg.className)}>
      {cfg.label}
    </span>
  );
}

// ─── Payment config ───────────────────────────────────────────────────────────
const PAYMENT_CONFIG: Record<BonPaymentMethod, { label: string; Icon: React.ElementType }> = {
  CASH:          { label: 'Espèce',   Icon: Banknote },
  BANK_TRANSFER: { label: 'Virement', Icon: Building2 },
  CHECK:         { label: 'Chèque',   Icon: FileText },
  CREDIT_CARD:   { label: 'Carte',    Icon: CreditCard },
};
const PAYMENT_VALUES: BonPaymentMethod[] = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD'];
const STATUS_VALUES: BonAchatStatus[] = ['PENDING', 'COMPLETED', 'CANCELLED'];
const VALID_PAYMENTS = new Set<string>(PAYMENT_VALUES);
const VALID_STATUSES = new Set<string>([...STATUS_VALUES, 'ALL']);

// ─── Pill toggle ─────────────────────────────────────────────────────────────
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

// ─── Date input ───────────────────────────────────────────────────────────────
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

// ─── Amount input with DH suffix ─────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
const BonAchatPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  // ── Filter state from URL ─────────────────────────────────────────────────
  const [search, setSearch]           = useState(() => searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState<BonAchatStatus | 'ALL'>(() => {
    const v = searchParams.get('status') ?? 'ALL';
    return VALID_STATUSES.has(v) ? (v as BonAchatStatus | 'ALL') : 'ALL';
  });
  const [paymentStr, setPaymentStr]   = useState(() => searchParams.get('payment') ?? '');
  const [dateFrom, setDateFrom]       = useState(() => searchParams.get('from') ?? '');
  const [dateTo, setDateTo]           = useState(() => searchParams.get('to') ?? '');
  const [minAmount, setMinAmount]     = useState(() => searchParams.get('minAmount') ?? '');
  const [maxAmount, setMaxAmount]     = useState(() => searchParams.get('maxAmount') ?? '');
  const [sortBy, setSortBy]           = useState<SortField>(() => (searchParams.get('sort') as SortField) ?? 'date');
  const [sortOrder, setSortOrder]     = useState<'ASC' | 'DESC'>(() => (searchParams.get('order') as 'ASC' | 'DESC') ?? 'DESC');
  const [currentPage, setCurrentPage] = useState(() => Number(searchParams.get('page')) || 1);
  const [itemsPerPage, setItemsPerPage] = useState(() => Number(searchParams.get('perPage')) || ITEMS_PER_PAGE);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // ── Derived payment Set ───────────────────────────────────────────────────
  const paymentFilters = useMemo<Set<BonPaymentMethod>>(() => {
    const vals = paymentStr.split(',').filter((v): v is BonPaymentMethod => VALID_PAYMENTS.has(v));
    return new Set(vals);
  }, [paymentStr]);

  const togglePayment = (value: BonPaymentMethod) => {
    setPaymentStr(prev => {
      const set = new Set(prev.split(',').filter((v): v is BonPaymentMethod => VALID_PAYMENTS.has(v)));
      if (set.has(value)) set.delete(value); else set.add(value);
      return [...set].sort().join(',');
    });
  };
  const clearPayment = () => setPaymentStr('');

  // ── Debounced values ──────────────────────────────────────────────────────
  const debouncedSearch    = useDebounce(search, 300);
  const debouncedMinAmount = useDebounce(minAmount, 400);
  const debouncedMaxAmount = useDebounce(maxAmount, 400);

  const amountError = !!(debouncedMinAmount && debouncedMaxAmount && Number(debouncedMinAmount) > Number(debouncedMaxAmount));

  // ── List state ────────────────────────────────────────────────────────────
  const [bonAchats, setBonAchats]     = useState<BonAchat[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [totalBons, setTotalBons]     = useState(0);
  const [deleteId, setDeleteId]       = useState<string | null>(null);

  // ── Sync URL ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const p = new URLSearchParams();
    if (debouncedSearch)              p.set('q', debouncedSearch);
    if (statusFilter !== 'ALL')       p.set('status', statusFilter);
    if (paymentStr)                   p.set('payment', paymentStr);
    if (dateFrom)                     p.set('from', dateFrom);
    if (dateTo)                       p.set('to', dateTo);
    if (debouncedMinAmount)           p.set('minAmount', debouncedMinAmount);
    if (debouncedMaxAmount)           p.set('maxAmount', debouncedMaxAmount);
    if (sortBy !== 'date')            p.set('sort', sortBy);
    if (sortOrder !== 'DESC')         p.set('order', sortOrder);
    if (currentPage > 1)              p.set('page', String(currentPage));
    if (itemsPerPage !== ITEMS_PER_PAGE) p.set('perPage', String(itemsPerPage));
    setSearchParams(p, { replace: true });
  }, [debouncedSearch, statusFilter, paymentStr, dateFrom, dateTo, debouncedMinAmount, debouncedMaxAmount, sortBy, sortOrder, currentPage, itemsPerPage]);

  // ── Reset page on filter change ───────────────────────────────────────────
  useEffect(() => { setCurrentPage(1); },
    [debouncedSearch, statusFilter, paymentStr, dateFrom, dateTo, debouncedMinAmount, debouncedMaxAmount]);

  // ── API params ────────────────────────────────────────────────────────────
  const apiFilters = useMemo(() => ({
    search:        debouncedSearch    || undefined,
    dateFrom:      dateFrom           || undefined,
    dateTo:        dateTo             || undefined,
    status:        statusFilter !== 'ALL' ? statusFilter as BonAchatStatus : undefined,
    paymentMethod: paymentStr         || undefined,
    minAmount:     (!amountError && debouncedMinAmount) ? debouncedMinAmount : undefined,
    maxAmount:     (!amountError && debouncedMaxAmount) ? debouncedMaxAmount : undefined,
    sortBy,
    sortOrder,
  }), [debouncedSearch, dateFrom, dateTo, statusFilter, paymentStr, debouncedMinAmount, debouncedMaxAmount, amountError, sortBy, sortOrder]);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => { loadBonAchats(); }, [apiFilters, currentPage, itemsPerPage]);

  const loadBonAchats = async () => {
    try {
      setLoading(true);
      setError('');
      const data: any = await getBonAchats({ ...apiFilters, page: currentPage, pageSize: itemsPerPage, paged: true });
      if (Array.isArray(data)) {
        setBonAchats(data);
        setTotalBons(data.length < itemsPerPage
          ? (currentPage - 1) * itemsPerPage + data.length
          : currentPage * itemsPerPage + 1);
      } else if (data?.data) {
        setBonAchats(data.data);
        setTotalBons(data.total ?? data.data.length);
      } else {
        setBonAchats([]);
        setTotalBons(0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erreur lors du chargement');
      setBonAchats([]);
    } finally {
      setLoading(false);
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
  const hasFilters = !!(debouncedSearch || dateFrom || dateTo || statusFilter !== 'ALL' || paymentStr || debouncedMinAmount || debouncedMaxAmount);

  const resetFilters = () => {
    setSearch(''); setDateFrom(''); setDateTo('');
    setStatusFilter('ALL'); setPaymentStr('');
    setMinAmount(''); setMaxAmount('');
  };

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalBons / itemsPerPage));
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
      await deleteBonAchat(deleteId);
      toast({ title: "Bon d'achat supprimé avec succès" });
      setDeleteId(null);
      loadBonAchats();
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.response?.data?.message || 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const pageTotals = useMemo(() => bonAchats.reduce(
    (acc, b) => ({ total: acc.total + Number(b.totalAmount), paid: acc.paid + Number(b.paidAmount), remaining: acc.remaining + Number(b.remainingAmount) }),
    { total: 0, paid: 0, remaining: 0 }
  ), [bonAchats]);

  // ── Filter panel (shared) ─────────────────────────────────────────────────
  const FilterPanel = () => (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Statut</p>
        <div className="flex gap-1.5 flex-wrap">
          <Pill active={statusFilter === 'ALL'} onClick={() => setStatusFilter('ALL')}>Tous</Pill>
          {STATUS_VALUES.map(s => (
            <Pill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {STATUS_CONFIG[s].label}
            </Pill>
          ))}
        </div>
      </div>

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

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Période</p>
        <div className="flex items-center gap-2">
          <DateInput value={dateFrom} onChange={setDateFrom} placeholder="Date début" />
          <span className="text-muted-foreground text-xs shrink-0">→</span>
          <DateInput value={dateTo} onChange={setDateTo} placeholder="Date fin" />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Montant Total</p>
        <div className="flex items-center gap-2">
          <DhInput value={minAmount} onChange={setMinAmount} placeholder="Min" error={amountError} />
          <span className="text-muted-foreground text-xs shrink-0">–</span>
          <DhInput value={maxAmount} onChange={setMaxAmount} placeholder="Max" error={amountError} />
        </div>
        {amountError && <p className="text-[11px] text-destructive mt-1">Le minimum doit être inférieur au maximum</p>}
      </div>
    </div>
  );

  // ── Active filter chips ───────────────────────────────────────────────────
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
          Statut : {STATUS_CONFIG[statusFilter as BonAchatStatus].label}
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
      {(debouncedMinAmount || debouncedMaxAmount) && !amountError && (
        <Badge variant="secondary" className="gap-1 text-xs font-normal h-6 pr-1">
          Montant : {debouncedMinAmount || '0'} – {debouncedMaxAmount || '∞'} DH
          <button onClick={() => { setMinAmount(''); setMaxAmount(''); }} className="ml-0.5 rounded hover:bg-muted"><X className="h-3 w-3" /></button>
        </Badge>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50/50 lg:bg-background p-4 lg:p-6 w-full max-w-full overflow-x-hidden">

      {/* Mobile back */}
      <div className="lg:hidden mb-4">
        <Button variant="ghost" onClick={() => navigate('/')} size="sm" className="h-9 px-3 text-sm">
          <ArrowLeft className="h-4 w-4 mr-2" />Retour au tableau de bord
        </Button>
      </div>

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <h1 className="text-2xl font-bold">Bons d'achat</h1>
        <Button onClick={() => navigate('/bon-achat/new')} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />Nouveau Bon d'achat
        </Button>
      </div>

      {/* ── Row 1: search + per-page + reset ───────────────────────────────── */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Code ou nom du fournisseur..."
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

        {/* Reset (desktop) */}
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
                  {[debouncedSearch, statusFilter !== 'ALL', paymentStr, dateFrom || dateTo, (debouncedMinAmount || debouncedMaxAmount) && !amountError].filter(Boolean).length}
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
              {STATUS_VALUES.map(s => (
                <Pill key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                  {STATUS_CONFIG[s].label}
                </Pill>
              ))}
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

          {/* Amount range */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Montant{amountError && <span className="text-destructive ml-2 normal-case font-normal">min &gt; max</span>}
            </p>
            <div className="flex items-center gap-2">
              <DhInput value={minAmount} onChange={setMinAmount} placeholder="Min" error={amountError} />
              <span className="text-muted-foreground text-xs">–</span>
              <DhInput value={maxAmount} onChange={setMaxAmount} placeholder="Max" error={amountError} />
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
            <span className="font-semibold text-foreground">{totalBons}</span> bon{totalBons !== 1 ? 's' : ''} trouvé{totalBons !== 1 ? 's' : ''}
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
                        { field: 'code',          label: 'Code',        right: false },
                        { field: 'date',          label: 'Date',        right: false },
                        { field: 'supplier',      label: 'Fournisseur', right: false },
                        { field: 'status',        label: 'Statut',      right: false },
                        { field: 'paymentMethod', label: 'Paiement',    right: false },
                        { field: 'totalAmount',   label: 'Total',       right: true },
                      ] as const
                    ).map(({ field, label, right }) => (
                      <TableHead
                        key={field}
                        className={cn('h-9 px-3 text-xs font-semibold cursor-pointer hover:bg-muted/70 select-none', right && 'text-right')}
                        onClick={() => handleSort(field as SortField)}
                      >
                        <div className={cn('flex items-center', right && 'justify-end')}>
                          {label}<SortIcon field={field as SortField} />
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="h-9 px-3 text-xs font-semibold text-right w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonAchats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16">
                        <div className="flex flex-col items-center gap-3 text-muted-foreground">
                          <FileX className="h-12 w-12 opacity-20" />
                          <p className="text-sm font-medium">Aucun bon d'achat ne correspond à vos critères</p>
                          {hasFilters && (
                            <Button variant="outline" size="sm" onClick={resetFilters} className="mt-1">
                              <RotateCcw className="h-3.5 w-3.5 mr-2" />Réinitialiser les filtres
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : bonAchats.map(bon => {
                    const payConf = bon.paymentMethod ? PAYMENT_CONFIG[bon.paymentMethod] : null;
                    return (
                      <TableRow key={bon.id} className="hover:bg-muted/30">
                        <TableCell className="px-3 py-2 text-xs font-mono font-medium">
                          <Highlight text={bon.code} query={debouncedSearch} />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-muted-foreground">
                          {new Date(bon.date).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs">
                          <Highlight text={bon.supplier?.name ?? '-'} query={debouncedSearch} />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <StatusBadge status={bon.status} />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          {payConf ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                              <payConf.Icon className="h-3.5 w-3.5 shrink-0" />
                              {payConf.label}
                            </span>
                          ) : <span className="text-xs text-muted-foreground/50">—</span>}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-right tabular-nums font-semibold">
                          {formatCurrency(bon.totalAmount)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/bon-achat/${bon.id}`)} title="Voir">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(`/bon-achat/${bon.id}?print=true`)} title="Imprimer">
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(bon.id)} title="Supprimer">
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
            {bonAchats.length > 0 && (
              <div className="flex justify-end items-center gap-5 px-4 py-2 bg-muted/30 border-t text-xs">
                <span className="text-muted-foreground">Sous-total (page)</span>
                <span className="tabular-nums">Payé : <strong>{formatCurrency(pageTotals.paid)}</strong></span>
                <span className="tabular-nums">Reste : <strong>{formatCurrency(pageTotals.remaining)}</strong></span>
                <span className="tabular-nums font-bold text-primary">Total : {formatCurrency(pageTotals.total)}</span>
              </div>
            )}
          </div>

          {/* ── Mobile cards ─────────────────────────────────────────────────── */}
          <div className="lg:hidden">
            {bonAchats.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground bg-white rounded-xl shadow-sm">
                <FileX className="h-12 w-12 opacity-20" />
                <p className="text-sm font-medium">Aucun bon d'achat ne correspond à vos critères</p>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <RotateCcw className="h-3.5 w-3.5 mr-2" />Réinitialiser les filtres
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {bonAchats.map(bon => {
                  const payConf = bon.paymentMethod ? PAYMENT_CONFIG[bon.paymentMethod] : null;
                  return (
                    <div key={bon.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="text-xs text-muted-foreground">{new Date(bon.date).toLocaleDateString('fr-FR')}</div>
                          <div className="font-bold font-mono">{bon.code}</div>
                        </div>
                        <StatusBadge status={bon.status} />
                      </div>
                      <div className="mb-3 pb-3 border-b">
                        <div className="font-semibold text-sm">
                          <Highlight text={bon.supplier?.name ?? '—'} query={debouncedSearch} />
                        </div>
                        {payConf && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                            <payConf.Icon className="h-3.5 w-3.5" />{payConf.label}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-sm font-semibold">Montant Total</span>
                        <span className="text-lg font-bold text-primary tabular-nums">{formatCurrency(bon.totalAmount)}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => navigate(`/bon-achat/${bon.id}`)}>
                          <Eye className="h-4 w-4 mr-2" />Voir
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 h-10" onClick={() => navigate(`/bon-achat/${bon.id}?print=true`)}>
                          <Printer className="h-4 w-4 mr-2" />Imprimer
                        </Button>
                        <Button variant="outline" size="sm" className="h-10 w-10 p-0 text-destructive border-destructive/20" onClick={() => setDeleteId(bon.id)}>
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
          {totalBons > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, totalBons)} sur {totalBons}
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

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible. Le stock sera réajusté.</AlertDialogDescription>
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

export default BonAchatPage;
