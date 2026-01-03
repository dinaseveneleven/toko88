import { useState, useMemo, useEffect, useCallback } from 'react';
import { Product, CartItem, ReceiptData, ReceiptDeliveryMethod } from '@/types/pos';
import { ProductCard } from '@/components/pos/ProductCard';
import { ProductGridSkeleton } from '@/components/pos/ProductCardSkeleton';
import { CartPanel } from '@/components/pos/CartPanel';
import { CheckoutModal } from '@/components/pos/CheckoutModal';
import { ReceiptDisplay } from '@/components/pos/ReceiptDisplay';
import { SearchBar } from '@/components/pos/SearchBar';
import { CategoryFilter } from '@/components/pos/CategoryFilter';
import { FloatingCartButton } from '@/components/pos/FloatingCartButton';
import { MobileCartSheet } from '@/components/pos/MobileCartSheet';
import { BluetoothPrinterButton } from '@/components/pos/BluetoothPrinterButton';
import { useToast } from '@/hooks/use-toast';
import { useGoogleSheets } from '@/hooks/useGoogleSheets';
import { useAuth } from '@/hooks/useAuth';
import { useTripleTap } from '@/hooks/useTripleTap';
import { supabase } from '@/integrations/supabase/client';
import { Package, LogOut, Shield, RefreshCw, History, Maximize, Minimize } from 'lucide-react';
import logo88 from '@/assets/logo-88.png';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useFullscreen } from '@/hooks/useFullscreen';
const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const { fetchProducts, getCachedProducts, saveTransaction, updateStock, error: sheetsError } = useGoogleSheets();
  const { isFullscreen, isSupported, toggleFullscreen } = useFullscreen();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptData | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<ReceiptDeliveryMethod>('display');
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pricingMode, setPricingMode] = useState<'retail' | 'grosir'>('retail');

  // Triple-tap gesture to toggle pricing mode
  const { handleTap: handleLogoTap } = useTripleTap({
    onTripleTap: () => {
      const newMode = pricingMode === 'retail' ? 'grosir' : 'retail';
      setPricingMode(newMode);
      toast({
        title: newMode === 'grosir' ? 'Mode Grosir Aktif' : 'Mode Eceran Aktif',
        description: newMode === 'grosir' 
          ? 'Tap 3x logo untuk kembali ke mode eceran' 
          : 'Harga eceran ditampilkan',
      });
    },
  });

  // Pull-to-refresh state
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);

  const loadProducts = useCallback(async () => {
    const sheetProducts = await fetchProducts();
    if (sheetProducts.length > 0) {
      setProducts(sheetProducts);
    }
    setInitialLoadDone(true);
  }, [fetchProducts]);

  // Load cached products immediately for instant display
  useEffect(() => {
    const cached = getCachedProducts();
    if (cached && cached.length > 0) {
      setProducts(cached);
    }
  }, [getCachedProducts]);

  // Auto-load products from Google Sheets on mount
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Refresh products when Inventory updates stock (same tab + other tabs)
  useEffect(() => {
    const handleCustom = () => {
      loadProducts();
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'pos:products_updated') {
        loadProducts();
      }
    };

    window.addEventListener('pos:products_updated', handleCustom as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('pos:products_updated', handleCustom as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [loadProducts]);

  // Auto-fullscreen on tablet/phone (touch devices under 1280px) - only once per session
  useEffect(() => {
    const hasAutoFullscreened = sessionStorage.getItem('auto-fullscreen-done');
    if (hasAutoFullscreened) return;

    const handleFirstInteraction = () => {
      // Only for touch devices (tablets/phones) with width < 1280px (not desktop)
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isNotDesktop = window.innerWidth < 1280;
      
      if (isTouchDevice && isNotDesktop && isSupported && !isFullscreen) {
        toggleFullscreen();
        sessionStorage.setItem('auto-fullscreen-done', 'true');
      }
      // Remove listeners after first interaction
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isNotDesktop = window.innerWidth < 1280;
    
    if (isTouchDevice && isNotDesktop && isSupported) {
      document.addEventListener('click', handleFirstInteraction, { once: true });
      document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    }

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [isSupported]); // Only run on mount

  // Pull-to-refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || window.scrollY > 0) {
      setPullDistance(0);
      return;
    }
    const currentY = e.touches[0].clientY;
    const distance = Math.max(0, currentY - pullStartY);
    setPullDistance(Math.min(distance, 150));
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) {
      setIsRefreshing(true);
      await loadProducts();
      toast({
        title: 'Produk diperbarui',
        description: 'Data produk telah dimuat ulang',
      });
      setIsRefreshing(false);
    }
    setPullDistance(0);
    setIsPulling(false);
  };

  const categories = useMemo(() => {
    return [...new Set(products.map(p => p.category))];
  }, [products]);


  const filteredProducts = useMemo(() => {
    const searchLower = search.toLowerCase();
    return products.filter((product) => {
      const matchesName = product.name.toLowerCase().includes(searchLower);
      // Also search in variant names and codes
      const matchesVariant = product.variants?.some(
        v => v.name.toLowerCase().includes(searchLower) || 
             v.code.toLowerCase().includes(searchLower)
      ) || false;
      const matchesSearch = matchesName || matchesVariant;
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  const handleAddToCart = (product: Product, quantity: number = 1, variantCode?: string, variantName?: string) => {
    // Determine priceType from current pricingMode
    const priceType: 'retail' | 'bulk' = pricingMode === 'grosir' ? 'bulk' : 'retail';
    
    // Get available stock for this variant or product
    let availableStock = product.stock;
    if (variantCode && product.variants) {
      const variant = product.variants.find(v => v.code === variantCode);
      if (variant) {
        availableStock = variant.stock;
      }
    }
    
    setCart((prev) => {
      // For variant products, match by product id + priceType + variantCode
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && 
                  item.priceType === priceType && 
                  item.variantCode === variantCode
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const newQuantity = Math.min(updated[existingIndex].quantity + quantity, availableStock);
        updated[existingIndex] = {
          ...updated[existingIndex],
          quantity: newQuantity,
        };
        return updated;
      }

      return [...prev, { 
        product, 
        quantity: Math.min(quantity, availableStock), 
        priceType, 
        discount: 0,
        variantCode,
        variantName,
      }];
    });

    const variantInfo = variantName ? ` [${variantName}]` : '';
    toast({
      title: 'Ditambahkan ke keranjang',
      description: `${quantity}x ${product.name}${variantInfo} (${priceType === 'retail' ? 'Eceran' : 'Grosir'})`,
    });
  };

  const handleUpdateQuantity = (productId: string, priceType: 'retail' | 'bulk', delta: number, variantCode?: string) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId && item.priceType === priceType && item.variantCode === variantCode) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            
            // Get available stock for variant or product
            let maxStock = item.product.stock;
            if (variantCode && item.product.variants) {
              const variant = item.product.variants.find(v => v.code === variantCode);
              if (variant) maxStock = variant.stock;
            }
            
            if (newQty > maxStock) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleSetQuantity = (productId: string, priceType: 'retail' | 'bulk', quantity: number, variantCode?: string) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId && item.priceType === priceType && item.variantCode === variantCode) {
            if (quantity <= 0) return null;
            
            // Get available stock for variant or product
            let maxStock = item.product.stock;
            if (variantCode && item.product.variants) {
              const variant = item.product.variants.find(v => v.code === variantCode);
              if (variant) maxStock = variant.stock;
            }
            
            const newQty = Math.min(quantity, maxStock);
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleSetItemDiscount = (productId: string, priceType: 'retail' | 'bulk', discount: number, variantCode?: string) => {
    setCart((prev) => {
      return prev.map((item) => {
        if (item.product.id === productId && item.priceType === priceType && item.variantCode === variantCode) {
          const price = priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
          const maxDiscount = price * item.quantity;
          return { ...item, discount: Math.min(maxDiscount, Math.max(0, discount)) };
        }
        return item;
      });
    });
  };

  const handleRemoveFromCart = (productId: string, priceType: 'retail' | 'bulk', variantCode?: string) => {
    setCart((prev) => prev.filter(
      (item) => !(item.product.id === productId && item.priceType === priceType && item.variantCode === variantCode)
    ));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleCheckoutComplete = async (
    receipt: ReceiptData,
    method: ReceiptDeliveryMethod,
    phone?: string
  ) => {
    // Save transaction to database for QR code invoice
    const { error: dbError } = await supabase
      .from('transactions')
      .insert([{
        id: receipt.id,
        items: JSON.parse(JSON.stringify(receipt.items)),
        subtotal: receipt.subtotal,
        discount: receipt.discount,
        total: receipt.total,
        payment_method: receipt.paymentMethod,
        cash_received: receipt.cashReceived || null,
        change: receipt.change || null,
        customer_phone: receipt.customerPhone || null,
        customer_name: receipt.customerName || null,
        cashier: 'Admin',
      }]);

    if (dbError) {
      console.error('Error saving to database:', dbError);
    }

    // Save transaction to Google Sheets
    const saved = await saveTransaction(receipt);
    if (saved) {
      toast({
        title: 'Transaksi tersimpan',
        description: 'Data tersimpan ke Google Sheets',
      });
    }

    // Update stock after sale - decrement stock for each item sold
    const stockUpdates = receipt.items.map(item => {
      const currentProduct = products.find(p => p.id === item.product.id);
      const currentStock = currentProduct?.stock ?? item.product.stock;
      const newStock = Math.max(0, currentStock - item.quantity);
      return {
        id: item.product.id,
        stock: newStock,
      };
    });

    const stockUpdated = await updateStock(stockUpdates);
    if (stockUpdated) {
      // Update local products state to reflect new stock
      setProducts(prev => prev.map(p => {
        const update = stockUpdates.find(u => u.id === p.id);
        return update ? { ...p, stock: update.stock } : p;
      }));
      console.log('Stock updated successfully');
    } else {
      console.error('Failed to update stock');
      toast({
        title: 'Peringatan',
        description: sheetsError ?? 'Stok gagal diperbarui di Google Sheets',
        variant: 'destructive',
      });
    }

    // Auto-send WhatsApp invoice if delivery method is whatsapp
    if (method === 'whatsapp' && receipt.customerPhone) {
      try {
        const { data, error } = await supabase.functions.invoke('send-whatsapp-invoice', {
          body: { 
            invoiceId: receipt.id, 
            phone: receipt.customerPhone 
          }
        });

        if (error) {
          console.error('Error sending WhatsApp:', error);
          toast({
            title: 'Gagal kirim WhatsApp',
            description: 'Struk gagal dikirim otomatis. Gunakan tombol manual.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'WhatsApp terkirim!',
            description: `Struk dikirim ke ${receipt.customerPhone}`,
          });
        }
      } catch (err) {
        console.error('WhatsApp send error:', err);
      }
    }

    setCurrentReceipt(receipt);
    setDeliveryMethod(method);
    setCheckoutOpen(false);
    setReceiptOpen(true);
    setCart([]);
  };

  const handleReceiptClose = () => {
    setReceiptOpen(false);
    setCurrentReceipt(null);
  };

  // Calculate cart totals for floating button (with item discounts in Rp)
  const cartTotal = cart.reduce((sum, item) => {
    const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
    const discount = item.discount || 0;
    const discountedTotal = (price * item.quantity) - discount;
    return sum + Math.max(0, discountedTotal);
  }, 0);
  const cartItemCount = cart.length;

  return (
    <div 
      className="min-h-screen bg-background"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      <div 
        className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none transition-all duration-200"
        style={{ 
          height: pullDistance,
          opacity: pullDistance > 30 ? 1 : 0 
        }}
      >
        <div className={`bg-primary text-primary-foreground rounded-full p-2 shadow-lg ${isRefreshing ? 'animate-spin' : ''}`}>
          <RefreshCw className="w-5 h-5" />
        </div>
      </div>

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container max-w-7xl mx-auto px-2 sm:px-4 py-2 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            {/* Logo - smaller on mobile, triple-tap to toggle mode */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <img 
                src={logo88} 
                alt="Toko 88" 
                className="h-8 sm:h-12 w-auto rounded-lg sm:rounded-xl cursor-pointer select-none" 
                onClick={handleLogoTap}
                onTouchEnd={handleLogoTap}
              />
              <div className="hidden sm:block">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-xl tracking-tight">TOKO 88</h1>
                  {pricingMode === 'grosir' && (
                    <span className="text-[10px] font-semibold bg-pos-bulk/20 text-pos-bulk px-2 py-0.5 rounded-full animate-pulse">
                      GROSIR
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Point of Sale System</p>
              </div>
              {/* Mobile mode indicator */}
              {pricingMode === 'grosir' && (
                <span className="sm:hidden text-[10px] font-semibold bg-pos-bulk/20 text-pos-bulk px-2 py-0.5 rounded-full animate-pulse">
                  GROSIR
                </span>
              )}
            </div>

            {/* Navigation - icon only on mobile */}
            <div className="flex items-center gap-1 sm:gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/inventory')}
                className="gap-2 px-2 sm:px-3 h-9 sm:h-9"
              >
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Inventory</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/transactions')}
                className="gap-2 px-2 sm:px-3 h-9 sm:h-9"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Riwayat</span>
              </Button>
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="gap-2 px-2 sm:px-3 h-9 sm:h-9"
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              )}
              {isSupported && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="gap-2 px-2 sm:px-3 h-9 sm:h-9"
                  title={isFullscreen ? 'Keluar Fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="gap-2 px-2 sm:px-3 h-9 sm:h-9 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Keluar</span>
              </Button>

              {/* Date/Time - hidden on mobile, compact on tablet */}
              <div className="hidden md:block text-right flex-shrink-0">
                <p className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString('id-ID', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long', 
                    year: 'numeric' 
                  })}
                </p>
                <p className="font-mono text-lg font-semibold text-primary">
                  {new Date().toLocaleTimeString('id-ID', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-2 sm:px-4 py-3 sm:py-6 pb-24 xl:pb-6">
        <div className="grid xl:grid-cols-3 gap-3 sm:gap-6">
          {/* Products Section - full width on mobile/tablet, 2/3 on desktop */}
          <div className="xl:col-span-2 space-y-3 sm:space-y-4">
            {/* Sticky Search and Filter Bar */}
            <div className="sticky top-[57px] sm:top-[73px] z-30 bg-background pt-2 pb-3 -mx-2 px-2 sm:-mx-4 sm:px-4 border-b border-border/50">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <div className="flex-1">
                  <SearchBar value={search} onChange={setSearch} />
                </div>
                <CategoryFilter
                  categories={categories}
                  selected={selectedCategory}
                  onSelect={setSelectedCategory}
                />
              </div>
            </div>

            {/* Responsive product grid: 2 cols mobile, 2 cols tablet (bigger cards), 3 cols xl desktop */}
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-2 sm:gap-4 md:gap-5">
              {!initialLoadDone && products.length === 0 ? (
                <ProductGridSkeleton count={6} />
              ) : (
                filteredProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    pricingMode={pricingMode}
                    onAdd={handleAddToCart}
                  />
                ))
              )}
            </div>

            {initialLoadDone && filteredProducts.length === 0 && products.length > 0 && (
              <div className="text-center py-8 sm:py-12 text-muted-foreground">
                <p className="text-base sm:text-lg">Produk tidak ditemukan</p>
                <p className="text-xs sm:text-sm">Coba kata kunci lain</p>
              </div>
            )}
          </div>

          {/* Cart Section - hidden on mobile/tablet, shown on xl desktop only */}
          <div className="xl:col-span-1 hidden xl:block">
            <div className="sticky top-16 sm:top-24 h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)]">
              <CartPanel
                items={cart}
                onUpdateQuantity={handleUpdateQuantity}
                onSetQuantity={handleSetQuantity}
                onSetDiscount={handleSetItemDiscount}
                onRemove={handleRemoveFromCart}
                onClear={handleClearCart}
                onCheckout={() => setCheckoutOpen(true)}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Bluetooth Printer Connection Button */}
      <BluetoothPrinterButton />

      {/* Floating Cart Button - shown on mobile/tablet (hidden on xl desktop) */}
      <FloatingCartButton
        itemCount={cartItemCount}
        total={cartTotal}
        onClick={() => setMobileCartOpen(true)}
      />

      {/* Mobile Cart Sheet */}
      <MobileCartSheet
        open={mobileCartOpen}
        onClose={() => setMobileCartOpen(false)}
        items={cart}
        onUpdateQuantity={handleUpdateQuantity}
        onSetQuantity={handleSetQuantity}
        onSetDiscount={handleSetItemDiscount}
        onRemove={handleRemoveFromCart}
        onClear={handleClearCart}
        onCheckout={() => setCheckoutOpen(true)}
      />

      {/* Modals */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        items={cart}
        onComplete={handleCheckoutComplete}
      />

      <ReceiptDisplay
        open={receiptOpen}
        onClose={handleReceiptClose}
        receipt={currentReceipt}
        deliveryMethod={deliveryMethod}
      />
    </div>
  );
};

export default Index;
