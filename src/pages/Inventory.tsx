import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Save, RefreshCw, Edit2, Check, X, Search, AlertTriangle, PlusCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/hooks/useAuth';
import { AddProductModal } from '@/components/inventory/AddProductModal';
import { CategoryFilter } from '@/components/pos/CategoryFilter';
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
  const { fetchProducts, updateInventory, updateStock, addProduct, loading: isLoading } = useGoogleSheets();
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
  
  // Debounce timeouts for stock input typing
  const stockDebounceRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Get unique categories from products
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category))];
    return cats.sort();
  }, [products]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === null || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
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

  // Auto-save stock to backend
  const saveStockNow = useCallback(async (productId: string, newStock: number) => {
    const safeStock = Math.max(0, Number.isFinite(newStock) ? newStock : 0);
    
    // Get previous value for rollback (from editedProducts, not products array)
    const prevStock = editedProducts[productId]?.stock ?? 0;
    
    // Mark as saving
    setSavingStockIds(prev => new Set(prev).add(productId));
    
    try {
      const success = await updateStock([{ id: productId, stock: safeStock }]);
      
      if (!success) {
        throw new Error('Failed to update stock');
      }
      
      // On success, sync the products array (base value) to match
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, stock: safeStock } : p));
    } catch (err) {
      // Rollback editedProducts on failure
      setEditedProducts(prev => ({
        ...prev,
        [productId]: { ...prev[productId], stock: prevStock }
      }));
      
      toast({
        title: "Gagal",
        description: "Gagal update stok",
        variant: "destructive",
      });
    } finally {
      setSavingStockIds(prev => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
    }
  }, [editedProducts, updateStock, toast]);

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
                    placeholder="Cari produk..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
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
            <div className="hidden lg:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
              <div className="col-span-3">Produk</div>
              <div className="col-span-2 text-right">Modal</div>
              <div className="col-span-2 text-right">Harga Eceran</div>
              <div className="col-span-2 text-right">Harga Grosir</div>
              <div className="col-span-1">Kategori</div>
              <div className="col-span-2 text-center">Stok</div>
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
                  <div className="hidden lg:grid lg:grid-cols-12 lg:gap-4 lg:items-center">
                    {/* Product Name */}
                    <div className="col-span-3">
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
                    <div className="col-span-2 text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={edited?.purchasePrice ?? 0}
                          onChange={(e) => handleFieldChange(product.id, 'purchasePrice', parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          min={0}
                        />
                      ) : (
                        <span className="font-mono text-sm text-orange-600 dark:text-orange-400">
                          {formatRupiah(edited?.purchasePrice ?? product.purchasePrice)}
                        </span>
                      )}
                    </div>
                    
                    {/* Retail Price */}
                    <div className="col-span-2 text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={edited?.retailPrice ?? 0}
                          onChange={(e) => handleFieldChange(product.id, 'retailPrice', parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          min={0}
                        />
                      ) : (
                        <span className="font-mono text-sm">{formatRupiah(edited?.retailPrice ?? product.retailPrice)}</span>
                      )}
                    </div>
                    
                    {/* Bulk Price */}
                    <div className="col-span-2 text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={edited?.bulkPrice ?? 0}
                          onChange={(e) => handleFieldChange(product.id, 'bulkPrice', parseInt(e.target.value) || 0)}
                          className="w-full text-right font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                          min={0}
                        />
                      ) : (
                        <span className="font-mono text-sm">{formatRupiah(edited?.bulkPrice ?? product.bulkPrice)}</span>
                      )}
                    </div>
                    
                    {/* Category */}
                    <div className="col-span-1">
                      <span className="text-xs px-2 py-1 bg-secondary rounded-full truncate">
                        {product.category}
                      </span>
                    </div>
                    
                    {/* Stock Controls */}
                    <div className="col-span-2 flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => cancelEditing(product.id)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600"
                            onClick={confirmEditing}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => startEditing(product.id)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                      )}
                      
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
                          value={edited?.stock ?? product.stock}
                          onChange={(e) => handleStockInputChange(product.id, e.target.value)}
                          onBlur={() => handleStockInputBlur(product.id)}
                          className={`w-16 text-center font-mono text-sm h-8 pr-5 ${
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
                            value={edited?.stock ?? product.stock}
                            onChange={(e) => handleStockInputChange(product.id, e.target.value)}
                            onBlur={() => handleStockInputBlur(product.id)}
                            className={`w-12 text-center font-mono text-sm h-7 px-1 pr-4 ${
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
                            value={edited?.purchasePrice ?? 0}
                            onChange={(e) => handleFieldChange(product.id, 'purchasePrice', parseInt(e.target.value) || 0)}
                            className="h-6 w-20 text-xs px-1"
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
                            value={edited?.retailPrice ?? 0}
                            onChange={(e) => handleFieldChange(product.id, 'retailPrice', parseInt(e.target.value) || 0)}
                            className="h-6 w-20 text-xs px-1"
                            min={0}
                          />
                        ) : (
                          <span className="font-mono text-primary">
                            {formatRupiah(edited?.retailPrice ?? product.retailPrice)}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => isEditing ? confirmEditing() : startEditing(product.id)}
                      >
                        {isEditing ? <Check className="w-3 h-3 text-green-600" /> : <Edit2 className="w-3 h-3" />}
                      </Button>
                    </div>

                    {/* Bulk price only shown when editing */}
                    {isEditing && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">Grosir:</span>
                          <Input
                            type="number"
                            value={edited?.bulkPrice ?? 0}
                            onChange={(e) => handleFieldChange(product.id, 'bulkPrice', parseInt(e.target.value) || 0)}
                            className="h-6 w-20 text-xs px-1"
                            min={0}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs text-destructive"
                          onClick={() => cancelEditing(product.id)}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Batal
                        </Button>
                      </div>
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
    </div>
  );
}