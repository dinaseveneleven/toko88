import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Save, RefreshCw, Edit2, Check, X, Search, AlertTriangle, PlusCircle, Loader2, Trash2, Wrench, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/hooks/useAuth';
import { AddProductModal } from '@/components/inventory/AddProductModal';
import { VariantStockEditor } from '@/components/inventory/VariantStockEditor';
import { VariantManagerModal } from '@/components/inventory/VariantManagerModal';
import { CategoryFilter } from '@/components/pos/CategoryFilter';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Product } from '@/types/pos';

const LOW_STOCK_THRESHOLD = 5;
const STOCK_SAVE_DEBOUNCE_MS = 600;

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface EditedProduct {
  retailPrice: number;
  bulkPrice: number;
  purchasePrice: number;
  stock: number;
}

export default function Inventory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    fetchProducts,
    updateInventory,
    updateStock,
    updateVariantStock,
    addProduct,
    deleteProduct,
    repairPriceFormat,
    addVariant,
    deleteVariant,
    updateVariantInventory,
    loading: isLoading,
    error: sheetsError,
  } = useGoogleSheets();
  const { isAuthenticated } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [editedProducts, setEditedProducts] = useState<Record<string, EditedProduct>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [savingStockIds, setSavingStockIds] = useState<Set<string>>(new Set());
  const [savingVariantKeys, setSavingVariantKeys] = useState<Set<string>>(new Set());
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isRepairingFormat, setIsRepairingFormat] = useState(false);
  const [variantManagerProduct, setVariantManagerProduct] = useState<Product | null>(null);
  // Debounce timeouts for stock input typing
  const stockDebounceRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Broadcast to other pages/tabs (POS) that product data has changed
  const broadcastProductsUpdated = useCallback((payload: { productId: string; stock: number }) => {
    const message = { ...payload, ts: Date.now() };
    try {
      localStorage.setItem('pos:products_updated', JSON.stringify(message));
    } catch {
      // ignore storage errors
    }
    window.dispatchEvent(new CustomEvent('pos:products_updated', { detail: message }));
  }, []);

  // Per-product stock save queue to prevent request races overwriting newer values
  // (e.g. debounce + blur + rapid typing causing multiple updateStock calls)
  const stockSaveStateRef = useRef<Record<string, { inFlight: boolean; pending?: number }>>({});

  // Get unique categories from products
  const categories = useMemo<string[]>(() => {
    const cats = Array.from(
      new Set(
        products
          .map((p) => p.category)
          .filter((c): c is string => typeof c === 'string' && c.length > 0)
      )
    );
    return cats.sort();
  }, [products]);

  // Filter products based on search and category
  // Also track which variant matches for highlighting
  const { filteredProducts, matchingVariants } = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();
    const variantMatches = new Map<string, string[]>(); // productId -> matching variant codes
    
    const filtered = products.filter(product => {
      const matchesProductName = product.name.toLowerCase().includes(searchLower);
      
      // Check variant matches
      const matchingCodes: string[] = [];
      if (product.variants && searchLower) {
        product.variants.forEach(v => {
          if (v.code.toLowerCase().includes(searchLower) || 
              v.name.toLowerCase().includes(searchLower)) {
            matchingCodes.push(v.code);
          }
        });
      }
      
      if (matchingCodes.length > 0) {
        variantMatches.set(product.id, matchingCodes);
      }
      
      const matchesSearch = matchesProductName || matchingCodes.length > 0;
      const matchesCategory = selectedCategory === null || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
    
    return { filteredProducts: filtered, matchingVariants: variantMatches };
  }, [products, searchQuery, selectedCategory]);

  // Load products when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
    }
  }, [isAuthenticated]);

  // Cleanup debounce timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(stockDebounceRefs.current).forEach(clearTimeout);
    };
  }, []);

  const loadProducts = async () => {
    setIsFetching(true);
    try {
      const fetchedProducts = await fetchProducts();
      if (fetchedProducts) {
        setProducts(fetchedProducts);
        const edited: Record<string, EditedProduct> = {};
        fetchedProducts.forEach(p => {
          edited[p.id] = {
            retailPrice: p.retailPrice,
            bulkPrice: p.bulkPrice,
            purchasePrice: p.purchasePrice,
            stock: p.stock,
          };
        });
        setEditedProducts(edited);
        setHasChanges(false);
        setEditingProductId(null);
      }
    } finally {
      setIsFetching(false);
    }
  };

  // Auto-save stock to backend (serialized per product to prevent out-of-order overwrites)
  const saveStockNow = useCallback(async (productId: string, newStock: number) => {
    const safeStock = Math.max(0, Number.isFinite(newStock) ? newStock : 0);

    const state = stockSaveStateRef.current[productId] ?? { inFlight: false };
    stockSaveStateRef.current[productId] = state;

    // If a save is already in progress for this product, just record the latest desired value.
    if (state.inFlight) {
      state.pending = safeStock;
      return;
    }

    state.inFlight = true;

    // Mark as saving
    setSavingStockIds(prev => new Set(prev).add(productId));

    let target = safeStock;

    try {
      // Loop in case user changed stock again while request was in flight
      // so the last value always wins (and is the one persisted to Sheets).
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const success = await updateStock([{ id: productId, stock: target }]);

        if (!success) {
          throw new Error('Failed to update stock');
        }

        // If another value arrived during the request, send one more update with latest.
        if (typeof state.pending === 'number' && state.pending !== target) {
          target = state.pending;
          state.pending = undefined;
          continue;
        }

        // On success, sync local state to the last persisted value
        setProducts(prev => prev.map(p => (p.id === productId ? { ...p, stock: target } : p)));
        setEditedProducts(prev => ({
          ...prev,
          [productId]: { ...prev[productId], stock: target },
        }));

        // Tell POS to refresh products
        broadcastProductsUpdated({ productId, stock: target });

        break;
      }
    } catch (err) {
      console.error('[Inventory] Stock update error:', err);

      // Rollback editedProducts on failure - use current products state as source of truth
      const product = products.find(p => p.id === productId);
      const rollbackStock = product?.stock ?? 0;

      setEditedProducts(prev => ({
        ...prev,
        [productId]: { ...prev[productId], stock: rollbackStock },
      }));

      toast({
        title: 'Gagal',
        description: sheetsError ?? 'Gagal update stok',
        variant: 'destructive',
      });
    } finally {
      state.inFlight = false;
      state.pending = undefined;

      setSavingStockIds(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }, [updateStock, products, toast, broadcastProductsUpdated]);

  const handleFieldChange = (productId: string, field: keyof EditedProduct, value: number) => {
    const safeValue = Number.isFinite(value) ? value : 0;
    const validValue = Math.max(0, safeValue);
    setEditedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: validValue,
      },
    }));
    // Only set hasChanges for price fields, not stock (stock auto-saves)
    if (field !== 'stock') {
      setHasChanges(true);
    }
  };

  // Handle stock input change with debounce
  const handleStockInputChange = useCallback((productId: string, value: string) => {
    const parsed = parseInt(value, 10);
    const safeValue = isNaN(parsed) ? 0 : Math.max(0, parsed);
    
    // Update UI immediately
    setEditedProducts(prev => ({
      ...prev,
      [productId]: { ...prev[productId], stock: safeValue }
    }));
    
    // Clear previous debounce for this product
    if (stockDebounceRefs.current[productId]) {
      clearTimeout(stockDebounceRefs.current[productId]);
    }
    
    // Set new debounce to auto-save
    stockDebounceRefs.current[productId] = setTimeout(() => {
      saveStockNow(productId, safeValue);
    }, STOCK_SAVE_DEBOUNCE_MS);
  }, [saveStockNow]);

  // Handle stock input blur - immediately save
  const handleStockInputBlur = useCallback((productId: string) => {
    // Clear any pending debounce
    if (stockDebounceRefs.current[productId]) {
      clearTimeout(stockDebounceRefs.current[productId]);
      delete stockDebounceRefs.current[productId];
    }
    
    const currentStock = editedProducts[productId]?.stock ?? 0;
    const product = products.find(p => p.id === productId);
    
    // Only save if different from backend value
    if (product && currentStock !== product.stock) {
      saveStockNow(productId, currentStock);
    }
  }, [editedProducts, products, saveStockNow]);

  const handleIncrement = useCallback((productId: string) => {
    const current = editedProducts[productId]?.stock ?? 0;
    const newStock = current + 1;
    setEditedProducts(prev => ({
      ...prev,
      [productId]: { ...prev[productId], stock: newStock }
    }));
    saveStockNow(productId, newStock);
  }, [editedProducts, saveStockNow]);

  const handleDecrement = useCallback((productId: string) => {
    const current = editedProducts[productId]?.stock ?? 0;
    const newStock = Math.max(0, current - 1);
    setEditedProducts(prev => ({
      ...prev,
      [productId]: { ...prev[productId], stock: newStock }
    }));
    saveStockNow(productId, newStock);
  }, [editedProducts, saveStockNow]);

  // Handle variant stock update
  const handleUpdateVariantStock = useCallback(async (productId: string, variantCode: string, stock: number) => {
    const variantKey = `${productId}|${variantCode}`;
    
    setSavingVariantKeys(prev => new Set(prev).add(variantKey));
    
    try {
      const success = await updateVariantStock([{ productId, variantCode, stock }]);
      
      if (success) {
        // Update local product state
        setProducts(prev => prev.map(p => {
          if (p.id === productId && p.variants) {
            const updatedVariants = p.variants.map(v => 
              v.code === variantCode ? { ...v, stock } : v
            );
            const totalStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
            return { ...p, variants: updatedVariants, stock: totalStock };
          }
          return p;
        }));
        
        // Broadcast update
        broadcastProductsUpdated({ productId, stock });
      } else {
        toast({
          title: 'Gagal',
          description: sheetsError ?? 'Gagal update stok varian',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('[Inventory] Variant stock update error:', err);
      toast({
        title: 'Gagal',
        description: 'Gagal update stok varian',
        variant: 'destructive',
      });
    } finally {
      setSavingVariantKeys(prev => {
        const next = new Set(prev);
        next.delete(variantKey);
        return next;
      });
    }
  }, [updateVariantStock, broadcastProductsUpdated, toast, sheetsError]);

  // Handle variant inventory update (price changes)
  const handleUpdateVariantInventory = useCallback(async (productId: string, variantCode: string, updates: { stock?: number; retailPrice?: number | ''; bulkPrice?: number | '' }) => {
    const variantKey = `${productId}|${variantCode}`;
    
    setSavingVariantKeys(prev => new Set(prev).add(variantKey));
    
    try {
      const success = await updateVariantInventory([{ productId, variantCode, ...updates }]);
      
      if (success) {
        // Update local product state
        setProducts(prev => prev.map(p => {
          if (p.id === productId && p.variants) {
            const updatedVariants = p.variants.map(v => {
              if (v.code === variantCode) {
                return {
                  ...v,
                  ...(updates.stock !== undefined ? { stock: updates.stock } : {}),
                  ...(updates.retailPrice !== undefined ? { retailPrice: updates.retailPrice === '' ? undefined : updates.retailPrice } : {}),
                  ...(updates.bulkPrice !== undefined ? { bulkPrice: updates.bulkPrice === '' ? undefined : updates.bulkPrice } : {}),
                };
              }
              return v;
            });
            const totalStock = updatedVariants.reduce((sum, v) => sum + v.stock, 0);
            return { ...p, variants: updatedVariants, stock: totalStock };
          }
          return p;
        }));
        
        return true;
      } else {
        toast({
          title: 'Gagal',
          description: sheetsError ?? 'Gagal update varian',
          variant: 'destructive',
        });
        return false;
      }
    } catch (err) {
      console.error('[Inventory] Variant inventory update error:', err);
      toast({
        title: 'Gagal',
        description: 'Gagal update varian',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSavingVariantKeys(prev => {
        const next = new Set(prev);
        next.delete(variantKey);
        return next;
      });
    }
  }, [updateVariantInventory, toast, sheetsError]);

  const startEditing = (productId: string) => {
    setEditingProductId(productId);
  };

  const cancelEditing = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setEditedProducts(prev => ({
        ...prev,
        [productId]: {
          retailPrice: product.retailPrice,
          bulkPrice: product.bulkPrice,
          purchasePrice: product.purchasePrice,
          stock: product.stock,
        },
      }));
    }
    setEditingProductId(null);
  };

  const confirmEditing = () => {
    setEditingProductId(null);
  };

  const hasProductChanges = (product: Product): boolean => {
    const edited = editedProducts[product.id];
    if (!edited) return false;
    return (
      edited.retailPrice !== product.retailPrice ||
      edited.bulkPrice !== product.bulkPrice ||
      edited.purchasePrice !== product.purchasePrice ||
      edited.stock !== product.stock
    );
  };

  const handleSaveChanges = async () => {
    const inventoryUpdates = products
      .filter(p => hasProductChanges(p))
      .map(p => ({
        id: p.id,
        retailPrice: editedProducts[p.id].retailPrice,
        bulkPrice: editedProducts[p.id].bulkPrice,
        purchasePrice: editedProducts[p.id].purchasePrice,
        stock: editedProducts[p.id].stock,
      }));

    if (inventoryUpdates.length === 0) {
      setHasChanges(false);
      return;
    }

    const success = await updateInventory(inventoryUpdates);
    
    if (success) {
      toast({
        title: "Berhasil",
        description: `${inventoryUpdates.length} produk berhasil diperbarui`,
      });
      await loadProducts();
    } else {
      toast({
        title: "Gagal",
        description: "Gagal menyimpan perubahan",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    
    setDeletingProductId(productToDelete.id);
    
    const success = await deleteProduct(productToDelete.id);
    
    if (success) {
      // Remove from local state
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
      setEditedProducts(prev => {
        const next = { ...prev };
        delete next[productToDelete.id];
        return next;
      });
      
      toast({
        title: "Berhasil",
        description: `${productToDelete.name} berhasil dihapus`,
      });
    } else {
      toast({
        title: "Gagal",
        description: "Gagal menghapus produk",
        variant: "destructive",
      });
    }
    
    setDeletingProductId(null);
    setProductToDelete(null);
  };

  const handleRepairPriceFormat = async () => {
    setIsRepairingFormat(true);
    try {
      const success = await repairPriceFormat();
      if (success) {
        toast({
          title: "Berhasil",
          description: "Format harga di Google Sheets berhasil diperbaiki",
        });
      } else {
        toast({
          title: "Gagal",
          description: "Gagal memperbaiki format harga",
          variant: "destructive",
        });
      }
    } finally {
      setIsRepairingFormat(false);
    }
  };

  // Show loading while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-3 sm:px-4 py-2 sm:py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <h1 className="text-lg sm:text-xl font-bold">Inventory</h1>
          </div>
          
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              disabled={isLoading || isFetching}
              className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
            >
              <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              <span className="hidden sm:inline">Tambah Produk</span>
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={loadProducts}
              disabled={isFetching}
              className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRepairPriceFormat}
              disabled={isRepairingFormat || isFetching}
              className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
              title="Perbaiki format harga di Google Sheets ke format mata uang"
            >
              {isRepairingFormat ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2 animate-spin" />
              ) : (
                <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Repair Format</span>
            </Button>
            
            {hasChanges && (
              <Button size="sm" onClick={handleSaveChanges} disabled={isLoading || isFetching} className="h-8 px-2 sm:px-3 text-xs sm:text-sm">
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 sm:mr-2" />
                <span className="hidden sm:inline">Simpan</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-4">
        {isFetching ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-4">Tidak ada produk</p>
            <Button onClick={loadProducts}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Muat Produk
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Sticky Search and Filter Bar */}
            <div className="sticky top-[57px] sm:top-[65px] z-30 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Cari produk..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                {/* Category Filter Dropdown */}
                <CategoryFilter
                  categories={categories}
                  selected={selectedCategory}
                  onSelect={setSelectedCategory}
                />
              </div>
            </div>

            {/* Header Row - Desktop */}
            <div className="hidden lg:grid grid-cols-[2fr_1fr_1fr_1fr_auto_auto_auto] gap-3 px-4 py-2 text-sm font-medium text-muted-foreground">
              <div>Produk</div>
              <div className="text-right">Modal</div>
              <div className="text-right">Harga Eceran</div>
              <div className="text-right">Harga Grosir</div>
              <div className="w-24">Kategori</div>
              <div className="w-32 text-center">Stok</div>
              <div className="w-28 text-center">Aksi</div>
            </div>

            {/* Product Rows */}
            {filteredProducts.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                Tidak ada produk yang cocok
              </div>
            ) : filteredProducts.map((product) => {
              const edited = editedProducts[product.id];
              const isEditing = editingProductId === product.id;
              const isChanged = hasProductChanges(product);
              const currentStock = edited?.stock ?? product.stock;
              const isLowStock = currentStock > 0 && currentStock <= LOW_STOCK_THRESHOLD;
              const isOutOfStock = currentStock === 0;
              
              return (
                <div 
                  key={product.id}
                  className={`bg-card rounded-xl border p-4 transition-colors ${
                    isChanged ? 'border-primary bg-primary/5' : 
                    isOutOfStock ? 'border-destructive/50 bg-destructive/5' :
                    isLowStock ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-border'
                  }`}
                >
                  {/* Desktop Layout */}
                  <div className="hidden lg:grid lg:grid-cols-[2fr_1fr_1fr_1fr_auto_auto_auto] lg:gap-3 lg:items-center">
                    {/* Product Name */}
                    <div>
                      <p className="font-medium">{product.name}</p>
                      {isOutOfStock && (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive mt-1">
                          <AlertTriangle className="w-3 h-3" /> Stok Habis
                        </span>
                      )}
                      {isLowStock && !isOutOfStock && (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-500 mt-1">
                          <AlertTriangle className="w-3 h-3" /> Stok Rendah
                        </span>
                      )}
                    </div>
                    
                    {/* Modal / Purchase Price */}
                    <div className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={(edited?.purchasePrice ?? 0) === 0 ? '' : (edited?.purchasePrice ?? 0)}
                          placeholder="0"
                          onChange={(e) => handleFieldChange(product.id, 'purchasePrice', parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40"
                          min={0}
                        />
                      ) : (
                        <span className="font-mono text-sm text-orange-600 dark:text-orange-400">
                          {formatRupiah(edited?.purchasePrice ?? product.purchasePrice)}
                        </span>
                      )}
                    </div>
                    
                    {/* Retail Price */}
                    <div className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={(edited?.retailPrice ?? 0) === 0 ? '' : (edited?.retailPrice ?? 0)}
                          placeholder="0"
                          onChange={(e) => handleFieldChange(product.id, 'retailPrice', parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40"
                          min={0}
                        />
                      ) : (
                        <span className="font-mono text-sm">{formatRupiah(edited?.retailPrice ?? product.retailPrice)}</span>
                      )}
                    </div>
                    
                    {/* Bulk Price */}
                    <div className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={(edited?.bulkPrice ?? 0) === 0 ? '' : (edited?.bulkPrice ?? 0)}
                          placeholder="0"
                          onChange={(e) => handleFieldChange(product.id, 'bulkPrice', parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/40"
                          min={0}
                        />
                      ) : (
                        <span className="font-mono text-sm">{formatRupiah(edited?.bulkPrice ?? product.bulkPrice)}</span>
                      )}
                    </div>
                    
                    {/* Category */}
                    <div className="w-24">
                      <span className="text-xs px-2 py-1 bg-secondary rounded-full truncate block text-center">
                        {product.category}
                      </span>
                    </div>
                    
                    {/* Stock Controls */}
                    <div className="w-32 flex items-center justify-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDecrement(product.id)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      
                      <div className="relative">
                        <Input
                          type="number"
                          value={(edited?.stock ?? product.stock) === 0 ? '' : (edited?.stock ?? product.stock)}
                          placeholder="0"
                          onChange={(e) => handleStockInputChange(product.id, e.target.value)}
                          onBlur={() => handleStockInputBlur(product.id)}
                          className={`w-14 text-center font-mono text-sm h-8 pr-4 placeholder:text-muted-foreground/40 ${
                            isOutOfStock ? 'text-destructive' : 
                            isLowStock ? 'text-yellow-600 dark:text-yellow-500' : ''
                          }`}
                          min={0}
                        />
                        {savingStockIds.has(product.id) && (
                          <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-muted-foreground" />
                        )}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleIncrement(product.id)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Actions */}
                    <div className="w-28 flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setProductToDelete(product)}
                            disabled={deletingProductId === product.id}
                          >
                            {deletingProductId === product.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => cancelEditing(product.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:text-green-600"
                            onClick={confirmEditing}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary"
                            onClick={() => setVariantManagerProduct(product)}
                            title="Kelola Varian"
                          >
                            <Layers className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEditing(product.id)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Variant Stock Editor - Desktop */}
                    {product.variants && product.variants.length > 0 && (
                      <div className="col-span-7 mt-2">
                        <VariantStockEditor
                          productId={product.id}
                          productName={product.name}
                          variants={product.variants}
                          product={product}
                          onUpdateVariantStock={handleUpdateVariantStock}
                          onUpdateVariantInventory={(productId, variantCode, stock, retailPrice, bulkPrice) => 
                            handleUpdateVariantInventory(productId, variantCode, { 
                              stock, 
                              retailPrice: retailPrice === undefined ? '' : retailPrice, 
                              bulkPrice: bulkPrice === undefined ? '' : bulkPrice 
                            })
                          }
                          savingVariantKeys={savingVariantKeys}
                          highlightedVariantCodes={matchingVariants.get(product.id) || []}
                        />
                      </div>
                    )}
                  </div>

                  {/* Mobile Layout */}
                  <div className="lg:hidden space-y-3">
                    {/* Product Name + Edit + Stock Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs px-2 py-0.5 bg-secondary rounded-full">
                            {product.category}
                          </span>
                          {isOutOfStock && (
                            <span className="text-xs text-destructive flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Habis
                            </span>
                          )}
                          {isLowStock && !isOutOfStock && (
                            <span className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-0.5">
                              <AlertTriangle className="w-3 h-3" /> Rendah
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Stock Controls - Always visible */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleDecrement(product.id)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <div className="relative">
                          <Input
                            type="number"
                            value={(edited?.stock ?? product.stock) === 0 ? '' : (edited?.stock ?? product.stock)}
                            placeholder="0"
                            onChange={(e) => handleStockInputChange(product.id, e.target.value)}
                            onBlur={() => handleStockInputBlur(product.id)}
                            className={`w-12 text-center font-mono text-sm h-7 px-1 pr-4 placeholder:text-muted-foreground/40 ${
                              isOutOfStock ? 'text-destructive' : 
                              isLowStock ? 'text-yellow-600 dark:text-yellow-500' : ''
                            }`}
                            min={0}
                          />
                          {savingStockIds.has(product.id) && (
                            <Loader2 className="absolute right-0.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 animate-spin text-muted-foreground" />
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleIncrement(product.id)}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Prices Row - Compact */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">Modal:</span>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={(edited?.purchasePrice ?? 0) === 0 ? '' : (edited?.purchasePrice ?? 0)}
                            placeholder="0"
                            onChange={(e) => handleFieldChange(product.id, 'purchasePrice', parseInt(e.target.value) || 0)}
                            className="h-6 w-20 text-xs px-1 placeholder:text-muted-foreground/40"
                            min={0}
                          />
                        ) : (
                          <span className="font-mono text-orange-600 dark:text-orange-400">
                            {formatRupiah(edited?.purchasePrice ?? product.purchasePrice)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">Eceran:</span>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={(edited?.retailPrice ?? 0) === 0 ? '' : (edited?.retailPrice ?? 0)}
                            placeholder="0"
                            onChange={(e) => handleFieldChange(product.id, 'retailPrice', parseInt(e.target.value) || 0)}
                            className="h-6 w-20 text-xs px-1 placeholder:text-muted-foreground/40"
                            min={0}
                          />
                        ) : (
                          <span className="font-mono text-primary">
                            {formatRupiah(edited?.retailPrice ?? product.retailPrice)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-primary"
                          onClick={() => setVariantManagerProduct(product)}
                          title="Kelola Varian"
                        >
                          <Layers className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => isEditing ? confirmEditing() : startEditing(product.id)}
                        >
                          {isEditing ? <Check className="w-3 h-3 text-green-600" /> : <Edit2 className="w-3 h-3" />}
                        </Button>
                      </div>
                    </div>

                    {/* Bulk price and delete only shown when editing */}
                    {isEditing && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Grosir:</span>
                          <Input
                            type="number"
                            value={(edited?.bulkPrice ?? 0) === 0 ? '' : (edited?.bulkPrice ?? 0)}
                            placeholder="0"
                            onChange={(e) => handleFieldChange(product.id, 'bulkPrice', parseInt(e.target.value) || 0)}
                            className="h-6 w-20 text-xs px-1 placeholder:text-muted-foreground/40"
                            min={0}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-destructive"
                            onClick={() => setProductToDelete(product)}
                            disabled={deletingProductId === product.id}
                          >
                            {deletingProductId === product.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3 mr-1" />
                            )}
                            Hapus
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => cancelEditing(product.id)}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Batal
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Variant Stock Editor - Mobile */}
                    {product.variants && product.variants.length > 0 && (
                      <VariantStockEditor
                        productId={product.id}
                        productName={product.name}
                        variants={product.variants}
                        product={product}
                        onUpdateVariantStock={handleUpdateVariantStock}
                        onUpdateVariantInventory={(productId, variantCode, stock, retailPrice, bulkPrice) => 
                          handleUpdateVariantInventory(productId, variantCode, { 
                            stock, 
                            retailPrice: retailPrice === undefined ? '' : retailPrice, 
                            bulkPrice: bulkPrice === undefined ? '' : bulkPrice 
                          })
                        }
                        savingVariantKeys={savingVariantKeys}
                        highlightedVariantCodes={matchingVariants.get(product.id) || []}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Product Modal */}
      <AddProductModal
        open={isAddModalOpen}
        onOpenChange={setIsAddModalOpen}
        categories={categories}
        onSuccess={loadProducts}
        addProduct={addProduct}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!productToDelete} onOpenChange={(open) => !open && setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Produk?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus <strong>{productToDelete?.name}</strong>? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingProductId}>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDeleteProduct();
              }}
              disabled={!!deletingProductId}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingProductId ? (
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

      {/* Variant Manager Modal */}
      {variantManagerProduct && (
        <VariantManagerModal
          open={!!variantManagerProduct}
          onOpenChange={(open) => !open && setVariantManagerProduct(null)}
          product={variantManagerProduct}
          onAddVariant={addVariant}
          onDeleteVariant={deleteVariant}
          onUpdateVariant={handleUpdateVariantInventory}
          onSuccess={loadProducts}
        />
      )}
    </div>
  );
}