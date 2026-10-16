import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getSuppliers, deleteSupplier, Supplier } from '@/api/suppliers';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useToast } from '@/hooks/use-toast';
import { AddSupplierDialog } from '@/components/suppliers/AddSupplierDialog';
import { EditSupplierDialog } from '@/components/suppliers/EditSupplierDialog';

const ITEMS_PER_PAGE = 50;

const Suppliers = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSuppliers, setTotalSuppliers] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(ITEMS_PER_PAGE);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  useEffect(() => {
    loadSuppliers();
  }, [search, currentPage, itemsPerPage]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError('');
      const data: any = await getSuppliers({ 
        search: search || undefined,
        page: currentPage,
        limit: itemsPerPage,
      });
      
      if (Array.isArray(data)) {
        setSuppliers(data);
        setTotalSuppliers(data.length < itemsPerPage ? (currentPage - 1) * itemsPerPage + data.length : (currentPage * itemsPerPage) + 1);
      } else if (data && Array.isArray((data as any).data)) {
        setSuppliers((data as any).data);
        setTotalSuppliers((data as any).total || (data as any).data.length);
      } else {
        setSuppliers([]);
        setTotalSuppliers(0);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors du chargement des fournisseurs');
      setSuppliers([]);
      setTotalSuppliers(0);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalSuppliers / itemsPerPage));

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderPaginationItems = () => {
    const items = [];
    
    if (totalPages <= 1) {
      return (
        <PaginationItem>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled>1</Button>
        </PaginationItem>
      );
    }

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
      items.push(
        <PaginationItem key={1}>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(1)}>1</Button>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(<PaginationItem key="ellipsis-start"><PaginationEllipsis /></PaginationItem>);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <Button
            variant={i === currentPage ? "outline" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => handlePageChange(i)}
          >
            {i}
          </Button>
        </PaginationItem>
      );
    }

    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        items.push(<PaginationItem key="ellipsis-end"><PaginationEllipsis /></PaginationItem>);
      }
      items.push(
        <PaginationItem key={totalPages}>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handlePageChange(totalPages)}>
            {totalPages}
          </Button>
        </PaginationItem>
      );
    }

    return items;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteSupplier(deleteId);
      toast({ title: 'Fournisseur supprimé avec succès' });
      setDeleteId(null);
      loadSuppliers();
    } catch (err: any) {
      toast({
        title: 'Erreur',
        description: err.response?.data?.message || 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="p-4 lg:p-6 w-full max-w-full overflow-x-hidden">
      {/* Mobile Return Button */}
      <div className="lg:hidden mb-4">
        <Button variant="ghost" onClick={() => navigate('/')} size="sm" className="h-9 px-3 text-sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour au tableau de bord
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-foreground">Fournisseurs</h1>
        <Button onClick={() => setAddDialogOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nouveau Fournisseur
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <Input
          placeholder="Rechercher un fournisseur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">Par page:</span>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => {
              setItemsPerPage(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-20 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && <LoadingSpinner />}
      {error && <ErrorMessage message={error} />}

      {!loading && !error && (
        <>
          {/* Desktop Table View */}
          <div className="hidden lg:block border rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-w-full w-full">
              <Table className="w-full table-auto">
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="h-9 px-3 text-xs font-semibold">Nom</TableHead>
                    <TableHead className="h-9 px-3 text-xs font-semibold">Téléphone</TableHead>
                    <TableHead className="h-9 px-3 text-xs font-semibold">Adresse</TableHead>
                    <TableHead className="h-9 px-3 text-xs font-semibold text-right w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suppliers.map((supplier) => (
                    <TableRow key={supplier.id} className="hover:bg-muted/30">
                      <TableCell className="px-3 py-2 text-xs font-medium"><Link title="Voir les documents et paiements" className="hover:underline text-primary" to={`/suppliers/${supplier.id}/documents`}>{supplier.name}</Link></TableCell>
                      <TableCell className="px-3 py-2 text-xs text-muted-foreground">{supplier.phone || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-xs text-muted-foreground">{supplier.address || '-'}</TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => {
                              setEditingSupplierId(supplier.id);
                              setEditDialogOpen(true);
                            }}
                            title="Modifier"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(supplier.id)}
                            title="Supprimer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {suppliers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                        Aucun fournisseur trouvé
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-3">
            {suppliers.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 text-sm">
                Aucun fournisseur trouvé
              </div>
            ) : (
              suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="border rounded-lg p-4 bg-card hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="font-semibold text-sm mb-1"><Link title="Voir les documents et paiements" className="hover:underline text-primary" to={`/suppliers/${supplier.id}/documents`}>{supplier.name}</Link></div>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-3 text-sm">
                    {supplier.phone && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Téléphone:</span>
                        <span>{supplier.phone}</span>
                      </div>
                    )}
                    {supplier.address && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Adresse:</span>
                        <span className="text-right">{supplier.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-h-[44px]"
                      onClick={() => {
                        setEditingSupplierId(supplier.id);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Modifier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 min-h-[44px] text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(supplier.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {totalSuppliers > 0 ? (
                <>Affichage de {(currentPage - 1) * itemsPerPage + 1} à {Math.min(currentPage * itemsPerPage, totalSuppliers)} sur {totalSuppliers} fournisseur{totalSuppliers > 1 ? 's' : ''}</>
              ) : (
                'Aucun fournisseur'
              )}
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1 || totalPages === 0}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Précédent</span>
                  </Button>
                </PaginationItem>
                {totalPages > 0 && renderPaginationItems()}
                <PaginationItem>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="gap-1"
                  >
                    <span>Suivant</span>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer ce fournisseur ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddSupplierDialog
        isOpen={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSave={(supplier) => {
          loadSuppliers();
        }}
      />

      <EditSupplierDialog
        isOpen={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) setEditingSupplierId(null);
        }}
        supplierId={editingSupplierId}
        onSave={(supplier) => {
          loadSuppliers();
        }}
      />
    </div>
  );
};

export default Suppliers;

