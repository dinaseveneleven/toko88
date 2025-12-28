import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Save, RefreshCw, Edit2, Check, X, Search, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/hooks/useAuth';
import type { Product } from '@/types/pos';

const LOW_STOCK_THRESHOLD = 5;

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
  const { fetchProducts, updateInventory, loading: isLoading } = useGoogleSheets();
  const { isAuthenticated } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [editedProducts, setEditedProducts] = useState<Record<string, EditedProduct>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Get unique categories from products
  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category))];
    return cats.sort();
  }, [products]);

  // Filter products based on search and category
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Load products when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadProducts();
    }
  }, [isAuthenticated]);

  const loadProducts = async () => {
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
  };

  const handleFieldChange = (productId: string, field: keyof EditedProduct, value: number) => {
    const validValue = Math.max(0, value);
    setEditedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: validValue,
      },
    }));
    setHasChanges(true);
  };

  const handleIncrement = (productId: string) => {
    const current = editedProducts[productId]?.stock ?? 0;
    handleFieldChange(productId, 'stock', current + 1);
  };

  const handleDecrement = (productId: string) => {
    const current = editedProducts[productId]?.stock ?? 0;
    handleFieldChange(productId, 'stock', current - 1);
  };

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
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Inventory</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadProducts}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            
            {hasChanges && (
              <Button size="sm" onClick={handleSaveChanges} disabled={isLoading}>
                <Save className="w-4 h-4 mr-2" />
                Simpan
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto p-4">
        {isLoading ? (
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
            {/* Search and Filter Bar */}
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
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      
                      <Input
                        type="number"
                        value={edited?.stock ?? product.stock}
                        onChange={(e) => handleFieldChange(product.id, 'stock', parseInt(e.target.value) || 0)}
                        className={`w-16 text-center font-mono text-sm h-8 ${
                          isOutOfStock ? 'text-destructive' : 
                          isLowStock ? 'text-yellow-600 dark:text-yellow-500' : ''
                        }`}
                        min={0}
                      />
                      
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
                  <div className="lg:hidden space-y-4">
                    {/* Product Name and Category */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <span className="text-xs px-2 py-0.5 bg-secondary rounded-full">
                          {product.category}
                        </span>
                        {isOutOfStock && (
                          <span className="inline-flex items-center gap-1 text-xs text-destructive ml-2">
                            <AlertTriangle className="w-3 h-3" /> Stok Habis
                          </span>
                        )}
                        {isLowStock && !isOutOfStock && (
                          <span className="inline-flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-500 ml-2">
                            <AlertTriangle className="w-3 h-3" /> Stok Rendah
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => isEditing ? confirmEditing() : startEditing(product.id)}
                      >
                        {isEditing ? <Check className="w-4 h-4 text-green-600" /> : <Edit2 className="w-4 h-4" />}
                      </Button>
                    </div>

                    {/* Prices */}
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Modal</p>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={edited?.purchasePrice ?? 0}
                            onChange={(e) => handleFieldChange(product.id, 'purchasePrice', parseInt(e.target.value) || 0)}
                            className="h-8 text-sm"
                            min={0}
                          />
                        ) : (
                          <p className="font-mono text-orange-600 dark:text-orange-400">
                            {formatRupiah(edited?.purchasePrice ?? product.purchasePrice)}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Eceran</p>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={edited?.retailPrice ?? 0}
                            onChange={(e) => handleFieldChange(product.id, 'retailPrice', parseInt(e.target.value) || 0)}
                            className="h-8 text-sm"
                            min={0}
                          />
                        ) : (
                          <p className="font-mono">{formatRupiah(edited?.retailPrice ?? product.retailPrice)}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs mb-1">Grosir</p>
                        {isEditing ? (
                          <Input
                            type="number"
                            value={edited?.bulkPrice ?? 0}
                            onChange={(e) => handleFieldChange(product.id, 'bulkPrice', parseInt(e.target.value) || 0)}
                            className="h-8 text-sm"
                            min={0}
                          />
                        ) : (
                          <p className="font-mono">{formatRupiah(edited?.bulkPrice ?? product.bulkPrice)}</p>
                        )}
                      </div>
                    </div>

                    {/* Stock Controls */}
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-sm">Stok:</p>
                      <div className="flex items-center gap-2">
                        {isEditing && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => cancelEditing(product.id)}
                          >
                            <X className="w-4 h-4" />
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
                        <Input
                          type="number"
                          value={edited?.stock ?? product.stock}
                          onChange={(e) => handleFieldChange(product.id, 'stock', parseInt(e.target.value) || 0)}
                          className={`w-16 text-center font-mono text-sm h-8 ${
                            isOutOfStock ? 'text-destructive' : 
                            isLowStock ? 'text-yellow-600 dark:text-yellow-500' : ''
                          }`}
                          min={0}
                        />
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}