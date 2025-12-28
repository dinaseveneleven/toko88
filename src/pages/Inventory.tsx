import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus, Save, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import type { Product } from '@/types/pos';

const PASSCODE = "8888";

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function Inventory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { fetchProducts, updateStock, loading: isLoading } = useGoogleSheets();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const handlePasscodeSubmit = () => {
    if (passcodeInput === PASSCODE) {
      setIsAuthenticated(true);
      loadProducts();
    } else {
      toast({
        title: "Kode Salah",
        description: "Passcode yang dimasukkan tidak valid",
        variant: "destructive",
      });
      setPasscodeInput('');
    }
  };

  const loadProducts = async () => {
    const fetchedProducts = await fetchProducts();
    if (fetchedProducts) {
      setProducts(fetchedProducts);
      const stocks: Record<string, number> = {};
      fetchedProducts.forEach(p => {
        stocks[p.id] = p.stock;
      });
      setEditedStocks(stocks);
      setHasChanges(false);
    }
  };

  const handleStockChange = (productId: string, newStock: number) => {
    const validStock = Math.max(0, newStock);
    setEditedStocks(prev => ({
      ...prev,
      [productId]: validStock,
    }));
    setHasChanges(true);
  };

  const handleIncrement = (productId: string) => {
    const current = editedStocks[productId] ?? 0;
    handleStockChange(productId, current + 1);
  };

  const handleDecrement = (productId: string) => {
    const current = editedStocks[productId] ?? 0;
    handleStockChange(productId, current - 1);
  };

  const handleSaveChanges = async () => {
    // Build the list of changed stocks
    const stockUpdates = products
      .filter(p => editedStocks[p.id] !== p.stock)
      .map(p => ({
        id: p.id,
        stock: editedStocks[p.id],
      }));

    if (stockUpdates.length === 0) {
      setHasChanges(false);
      return;
    }

    const success = await updateStock(stockUpdates);
    
    if (success) {
      toast({
        title: "Berhasil",
        description: `${stockUpdates.length} stok produk berhasil diperbarui`,
      });
      // Reload products to get the updated state
      await loadProducts();
    } else {
      toast({
        title: "Gagal",
        description: "Gagal menyimpan perubahan stok",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handlePasscodeSubmit();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-card rounded-2xl shadow-xl p-8 border border-border">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-primary" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-center mb-2">Inventory</h1>
            <p className="text-muted-foreground text-center mb-6">
              Masukkan passcode untuk mengakses
            </p>
            
            <Input
              type="password"
              placeholder="Masukkan passcode"
              value={passcodeInput}
              onChange={(e) => setPasscodeInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="text-center text-2xl tracking-widest mb-4"
              maxLength={10}
            />
            
            <Button 
              onClick={handlePasscodeSubmit} 
              className="w-full"
              size="lg"
            >
              Masuk
            </Button>
            
            <Button
              variant="ghost"
              onClick={() => navigate('/')}
              className="w-full mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Kembali ke POS
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
              <Button size="sm" onClick={handleSaveChanges}>
                <Save className="w-4 h-4 mr-2" />
                Simpan
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4">
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
          <div className="space-y-3">
            {/* Header Row */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground">
              <div className="col-span-4">Produk</div>
              <div className="col-span-2 text-right">Harga Eceran</div>
              <div className="col-span-2 text-right">Harga Grosir</div>
              <div className="col-span-2">Kategori</div>
              <div className="col-span-2 text-center">Stok</div>
            </div>

            {/* Product Rows */}
            {products.map((product) => {
              const currentStock = editedStocks[product.id] ?? product.stock;
              const isChanged = currentStock !== product.stock;
              
              return (
                <div 
                  key={product.id}
                  className={`bg-card rounded-xl border p-4 transition-colors ${
                    isChanged ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center space-y-3 md:space-y-0">
                    {/* Product Name */}
                    <div className="col-span-4">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground md:hidden">
                        {product.category}
                      </p>
                    </div>
                    
                    {/* Prices - Mobile */}
                    <div className="flex justify-between md:hidden text-sm">
                      <span className="text-muted-foreground">Eceran: {formatRupiah(product.retailPrice)}</span>
                      <span className="text-muted-foreground">Grosir: {formatRupiah(product.bulkPrice)}</span>
                    </div>
                    
                    {/* Prices - Desktop */}
                    <div className="col-span-2 text-right hidden md:block">
                      <span className="font-mono text-sm">{formatRupiah(product.retailPrice)}</span>
                    </div>
                    <div className="col-span-2 text-right hidden md:block">
                      <span className="font-mono text-sm">{formatRupiah(product.bulkPrice)}</span>
                    </div>
                    
                    {/* Category - Desktop */}
                    <div className="col-span-2 hidden md:block">
                      <span className="text-sm px-2 py-1 bg-secondary rounded-full">
                        {product.category}
                      </span>
                    </div>
                    
                    {/* Stock Controls */}
                    <div className="col-span-2 flex items-center justify-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleDecrement(product.id)}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      
                      <Input
                        type="number"
                        value={currentStock}
                        onChange={(e) => handleStockChange(product.id, parseInt(e.target.value) || 0)}
                        className="w-20 text-center font-mono"
                        min={0}
                      />
                      
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => handleIncrement(product.id)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {isChanged && (
                    <div className="mt-2 text-xs text-primary">
                      Diubah: {product.stock} → {currentStock}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
