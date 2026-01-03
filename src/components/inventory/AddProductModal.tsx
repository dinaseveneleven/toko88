import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useAppSettings } from '@/hooks/useAppSettings';

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  onSuccess: () => void;
  addProduct: (product: {
    name: string;
    category: string;
    purchasePrice: number;
    retailPrice: number;
    bulkPrice: number;
    stock: number;
  }) => Promise<boolean>;
}

export function AddProductModal({ 
  open, 
  onOpenChange, 
  categories, 
  onSuccess,
  addProduct 
}: AddProductModalProps) {
  const { toast } = useToast();
  const { settings } = useAppSettings();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const bulkPricePercentage = parseInt(settings?.bulk_price_percentage || '98', 10);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    purchasePrice: '',
    retailPrice: '',
    bulkPrice: '',
    stock: '',
  });

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      purchasePrice: '',
      retailPrice: '',
      bulkPrice: '',
      stock: '',
    });
  };

  const handleSubmit = async () => {
    // Validation - only name, category, and retail price are required
    if (!formData.name.trim()) {
      toast({ title: "Error", description: "Nama produk harus diisi", variant: "destructive" });
      return;
    }
    if (!formData.category.trim()) {
      toast({ title: "Error", description: "Kategori harus diisi", variant: "destructive" });
      return;
    }
    if (!formData.retailPrice || parseInt(formData.retailPrice) <= 0) {
      toast({ title: "Error", description: "Harga eceran harus lebih dari 0", variant: "destructive" });
      return;
    }

    const retailPrice = parseInt(formData.retailPrice) || 0;
    
    // Calculate bulk price if not provided
    let bulkPrice = parseInt(formData.bulkPrice) || 0;
    if (bulkPrice === 0) {
      bulkPrice = Math.round(retailPrice * bulkPricePercentage / 100);
    }

    setIsSubmitting(true);
    
    const success = await addProduct({
      name: formData.name.trim(),
      category: formData.category.trim(),
      purchasePrice: parseInt(formData.purchasePrice) || 0,
      retailPrice: retailPrice,
      bulkPrice: bulkPrice,
      stock: parseInt(formData.stock) || 0,
    });

    setIsSubmitting(false);

    if (success) {
      toast({ title: "Berhasil", description: "Produk baru berhasil ditambahkan" });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } else {
      toast({ title: "Gagal", description: "Gagal menambahkan produk", variant: "destructive" });
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  // Calculate auto bulk price for display hint
  const retailPriceNum = parseInt(formData.retailPrice) || 0;
  const autoBulkPrice = retailPriceNum > 0 ? Math.round(retailPriceNum * bulkPricePercentage / 100) : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Produk Baru</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Product Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nama Produk *</Label>
            <Input
              id="name"
              placeholder="Masukkan nama produk"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Kategori *</Label>
            <Input
              id="category"
              placeholder="Pilih atau ketik kategori baru"
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              list="category-list"
            />
            <datalist id="category-list">
              {categories.map(cat => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {/* Purchase Price - Optional */}
          <div className="space-y-2">
            <Label htmlFor="purchasePrice" className="text-muted-foreground">Harga Modal (Rp)</Label>
            <Input
              id="purchasePrice"
              type="number"
              placeholder="Opsional"
              min={0}
              value={formData.purchasePrice}
              onChange={(e) => handleChange('purchasePrice', e.target.value)}
              className="placeholder:text-muted-foreground/50"
            />
          </div>

          {/* Retail Price */}
          <div className="space-y-2">
            <Label htmlFor="retailPrice">Harga Eceran (Rp) *</Label>
            <Input
              id="retailPrice"
              type="number"
              placeholder="0"
              min={0}
              value={formData.retailPrice}
              onChange={(e) => handleChange('retailPrice', e.target.value)}
            />
          </div>

          {/* Bulk Price - Optional with auto calculation hint */}
          <div className="space-y-2">
            <Label htmlFor="bulkPrice" className="text-muted-foreground">Harga Grosir (Rp)</Label>
            <Input
              id="bulkPrice"
              type="number"
              placeholder={autoBulkPrice > 0 ? `Auto: ${autoBulkPrice.toLocaleString('id-ID')} (${bulkPricePercentage}%)` : 'Opsional'}
              min={0}
              value={formData.bulkPrice}
              onChange={(e) => handleChange('bulkPrice', e.target.value)}
              className="placeholder:text-muted-foreground/50"
            />
            {retailPriceNum > 0 && !formData.bulkPrice && (
              <p className="text-xs text-muted-foreground">
                Otomatis: {autoBulkPrice.toLocaleString('id-ID')} ({bulkPricePercentage}% dari eceran)
              </p>
            )}
          </div>

          {/* Initial Stock - Optional with transparent placeholder */}
          <div className="space-y-2">
            <Label htmlFor="stock" className="text-muted-foreground">Stok Awal</Label>
            <Input
              id="stock"
              type="number"
              placeholder="0"
              min={0}
              value={formData.stock}
              onChange={(e) => handleChange('stock', e.target.value)}
              className="placeholder:text-muted-foreground/30"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Tambah Produk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
