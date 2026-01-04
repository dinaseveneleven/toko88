import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2, Package, Edit2, Check, X } from 'lucide-react';
import { Product, ProductVariant } from '@/types/pos';
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

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface VariantManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
  onAddVariant: (productId: string, variantCode: string, variantName: string, stock: number, retailPrice?: number, bulkPrice?: number) => Promise<boolean>;
  onDeleteVariant: (productId: string, variantCode: string) => Promise<boolean>;
  onUpdateVariant?: (productId: string, variantCode: string, updates: { stock?: number; retailPrice?: number | ''; bulkPrice?: number | '' }) => Promise<boolean>;
  onSuccess: () => void;
}

export function VariantManagerModal({
  open,
  onOpenChange,
  product,
  onAddVariant,
  onDeleteVariant,
  onUpdateVariant,
  onSuccess,
}: VariantManagerModalProps) {
  const { toast } = useToast();
  const [isAdding, setIsAdding] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [variantToDelete, setVariantToDelete] = useState<ProductVariant | null>(null);
  const [editingVariantCode, setEditingVariantCode] = useState<string | null>(null);
  const [editedVariant, setEditedVariant] = useState<{ retailPrice: string; bulkPrice: string }>({ retailPrice: '', bulkPrice: '' });
  const [savingVariantCode, setSavingVariantCode] = useState<string | null>(null);

  const [newVariant, setNewVariant] = useState({
    code: '',
    name: '',
    stock: '0',
    retailPrice: '',
    bulkPrice: '',
  });

  const resetForm = () => {
    setNewVariant({ code: '', name: '', stock: '0', retailPrice: '', bulkPrice: '' });
  };

  const handleAddVariant = async () => {
    if (!newVariant.code.trim()) {
      toast({ title: 'Error', description: 'Kode varian harus diisi', variant: 'destructive' });
      return;
    }

    // Check for duplicate variant code
    const existingVariant = product.variants?.find(
      (v) => v.code.toUpperCase() === newVariant.code.trim().toUpperCase()
    );
    if (existingVariant) {
      toast({ title: 'Error', description: 'Kode varian sudah ada', variant: 'destructive' });
      return;
    }

    setIsAdding(true);

    const retailPrice = newVariant.retailPrice ? parseInt(newVariant.retailPrice) : undefined;
    const bulkPrice = newVariant.bulkPrice ? parseInt(newVariant.bulkPrice) : undefined;

    const success = await onAddVariant(
      product.id,
      newVariant.code.trim(),
      newVariant.name.trim() || newVariant.code.trim(),
      parseInt(newVariant.stock) || 0,
      retailPrice,
      bulkPrice
    );

    setIsAdding(false);

    if (success) {
      toast({ title: 'Berhasil', description: 'Varian berhasil ditambahkan' });
      resetForm();
      onSuccess();
    } else {
      toast({ title: 'Gagal', description: 'Gagal menambahkan varian', variant: 'destructive' });
    }
  };

  const handleDeleteVariant = async () => {
    if (!variantToDelete) return;

    setDeletingCode(variantToDelete.code);

    const success = await onDeleteVariant(product.id, variantToDelete.code);

    setDeletingCode(null);
    setVariantToDelete(null);

    if (success) {
      toast({ title: 'Berhasil', description: 'Varian berhasil dihapus' });
      onSuccess();
    } else {
      toast({ title: 'Gagal', description: 'Gagal menghapus varian', variant: 'destructive' });
    }
  };

  const startEditingVariant = (variant: ProductVariant) => {
    setEditingVariantCode(variant.code);
    setEditedVariant({
      retailPrice: variant.retailPrice?.toString() || '',
      bulkPrice: variant.bulkPrice?.toString() || '',
    });
  };

  const cancelEditingVariant = () => {
    setEditingVariantCode(null);
    setEditedVariant({ retailPrice: '', bulkPrice: '' });
  };

  const saveEditedVariant = async (variant: ProductVariant) => {
    if (!onUpdateVariant) return;
    
    setSavingVariantCode(variant.code);
    
    const retailPrice = editedVariant.retailPrice ? parseInt(editedVariant.retailPrice) : '';
    const bulkPrice = editedVariant.bulkPrice ? parseInt(editedVariant.bulkPrice) : '';
    
    const success = await onUpdateVariant(product.id, variant.code, {
      retailPrice,
      bulkPrice,
    });
    
    setSavingVariantCode(null);
    
    if (success) {
      toast({ title: 'Berhasil', description: 'Harga varian berhasil diperbarui' });
      setEditingVariantCode(null);
      onSuccess();
    } else {
      toast({ title: 'Gagal', description: 'Gagal memperbarui harga varian', variant: 'destructive' });
    }
  };

  const handleClose = () => {
    resetForm();
    setEditingVariantCode(null);
    onOpenChange(false);
  };

  const variants = product.variants || [];

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Kelola Varian - {product.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Existing Variants */}
            {variants.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Varian Saat Ini ({variants.length})
                </Label>
                <div className="space-y-2">
                  {variants.map((variant) => {
                    const isEditing = editingVariantCode === variant.code;
                    const isSaving = savingVariantCode === variant.code;
                    
                    return (
                      <div
                        key={variant.code}
                        className="p-3 bg-secondary/30 rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{variant.name}</p>
                            <p className="text-xs text-muted-foreground">Kode: {variant.code}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-mono px-2 py-1 rounded ${
                                variant.stock === 0
                                  ? 'bg-destructive/20 text-destructive'
                                  : variant.stock <= 5
                                  ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-500'
                                  : 'bg-secondary text-muted-foreground'
                              }`}
                            >
                              {variant.stock}
                            </span>
                            {!isEditing && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => startEditingVariant(variant)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setVariantToDelete(variant)}
                                  disabled={deletingCode === variant.code}
                                >
                                  {deletingCode === variant.code ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Price Display / Edit */}
                        {isEditing ? (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Harga Eceran</Label>
                              <Input
                                type="number"
                                value={editedVariant.retailPrice}
                                onChange={(e) => setEditedVariant(prev => ({ ...prev, retailPrice: e.target.value }))}
                                placeholder={`Default: ${formatRupiah(product.retailPrice)}`}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Harga Grosir</Label>
                              <Input
                                type="number"
                                value={editedVariant.bulkPrice}
                                onChange={(e) => setEditedVariant(prev => ({ ...prev, bulkPrice: e.target.value }))}
                                placeholder={`Default: ${formatRupiah(product.bulkPrice)}`}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-2 flex justify-end gap-2 mt-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditingVariant}
                                disabled={isSaving}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Batal
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => saveEditedVariant(variant)}
                                disabled={isSaving}
                              >
                                {isSaving ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4 mr-1" />
                                )}
                                Simpan
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span>
                              Eceran: <span className="font-mono text-foreground">
                                {variant.retailPrice ? formatRupiah(variant.retailPrice) : `(${formatRupiah(product.retailPrice)})`}
                              </span>
                            </span>
                            <span>
                              Grosir: <span className="font-mono text-foreground">
                                {variant.bulkPrice ? formatRupiah(variant.bulkPrice) : `(${formatRupiah(product.bulkPrice)})`}
                              </span>
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {variants.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Belum ada varian</p>
              </div>
            )}

            {/* Add New Variant Form */}
            <div className="border-t border-border pt-4 space-y-3">
              <Label className="text-sm font-medium">Tambah Varian Baru</Label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="variantCode" className="text-xs text-muted-foreground">
                    Kode Varian *
                  </Label>
                  <Input
                    id="variantCode"
                    placeholder="contoh: MERAH"
                    value={newVariant.code}
                    onChange={(e) =>
                      setNewVariant((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                    }
                    className="uppercase"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="variantName" className="text-xs text-muted-foreground">
                    Nama Varian
                  </Label>
                  <Input
                    id="variantName"
                    placeholder="contoh: Warna Merah"
                    value={newVariant.name}
                    onChange={(e) => setNewVariant((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="variantStock" className="text-xs text-muted-foreground">
                    Stok Awal
                  </Label>
                  <Input
                    id="variantStock"
                    type="number"
                    placeholder="0"
                    min={0}
                    value={newVariant.stock}
                    onChange={(e) => setNewVariant((prev) => ({ ...prev, stock: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="variantRetailPrice" className="text-xs text-muted-foreground">
                    Harga Eceran
                  </Label>
                  <Input
                    id="variantRetailPrice"
                    type="number"
                    placeholder={`Default: ${product.retailPrice}`}
                    min={0}
                    value={newVariant.retailPrice}
                    onChange={(e) => setNewVariant((prev) => ({ ...prev, retailPrice: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="variantBulkPrice" className="text-xs text-muted-foreground">
                    Harga Grosir
                  </Label>
                  <Input
                    id="variantBulkPrice"
                    type="number"
                    placeholder={`Default: ${product.bulkPrice}`}
                    min={0}
                    value={newVariant.bulkPrice}
                    onChange={(e) => setNewVariant((prev) => ({ ...prev, bulkPrice: e.target.value }))}
                  />
                </div>
              </div>

              <Button
                onClick={handleAddVariant}
                disabled={isAdding || !newVariant.code.trim()}
                className="w-full"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Tambah Varian
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!variantToDelete} onOpenChange={(open) => !open && setVariantToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Varian?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus varian <strong>{variantToDelete?.name}</strong> (
              {variantToDelete?.code})? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingCode}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteVariant();
              }}
              disabled={!!deletingCode}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingCode ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Hapus'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
