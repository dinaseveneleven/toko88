import { useState, useMemo } from 'react';
import { Product, CartItem, ReceiptData, ReceiptDeliveryMethod } from '@/types/pos';
import { sampleProducts, categories } from '@/data/sampleProducts';
import { ProductCard } from '@/components/pos/ProductCard';
import { CartPanel } from '@/components/pos/CartPanel';
import { CheckoutModal } from '@/components/pos/CheckoutModal';
import { ReceiptDisplay } from '@/components/pos/ReceiptDisplay';
import { SearchBar } from '@/components/pos/SearchBar';
import { CategoryFilter } from '@/components/pos/CategoryFilter';
import { useToast } from '@/hooks/use-toast';
import { Store } from 'lucide-react';

const Index = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [currentReceipt, setCurrentReceipt] = useState<ReceiptData | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<ReceiptDeliveryMethod>('display');

  const filteredProducts = useMemo(() => {
    return sampleProducts.filter((product) => {
      const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [search, selectedCategory]);

  const handleAddToCart = (product: Product, priceType: 'retail' | 'bulk') => {
    setCart((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.priceType === priceType
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        if (updated[existingIndex].quantity < product.stock) {
          updated[existingIndex] = {
            ...updated[existingIndex],
            quantity: updated[existingIndex].quantity + 1,
          };
        }
        return updated;
      }

      return [...prev, { product, quantity: 1, priceType }];
    });

    toast({
      title: 'Ditambahkan',
      description: `${product.name} (${priceType === 'retail' ? 'Eceran' : 'Grosir'})`,
    });
  };

  const handleUpdateQuantity = (productId: string, priceType: 'retail' | 'bulk', delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId && item.priceType === priceType) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stock) return item;
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  const handleRemoveFromCart = (productId: string, priceType: 'retail' | 'bulk') => {
    setCart((prev) => prev.filter(
      (item) => !(item.product.id === productId && item.priceType === priceType)
    ));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleCheckoutComplete = (
    receipt: ReceiptData,
    method: ReceiptDeliveryMethod,
    phone?: string
  ) => {
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="container max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-xl tracking-tight">TOKO 88</h1>
                <p className="text-xs text-muted-foreground">Point of Sale System</p>
              </div>
            </div>
            <div className="text-right">
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
      </header>

      {/* Main Content */}
      <main className="container max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Products Section */}
          <div className="lg:col-span-2 space-y-4">
            <SearchBar value={search} onChange={setSearch} />
            <CategoryFilter
              categories={categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onAdd={handleAddToCart}
                />
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <p className="text-lg">Produk tidak ditemukan</p>
                <p className="text-sm">Coba kata kunci lain</p>
              </div>
            )}
          </div>

          {/* Cart Section */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <CartPanel
                items={cart}
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={handleRemoveFromCart}
                onClear={handleClearCart}
                onCheckout={() => setCheckoutOpen(true)}
              />
            </div>
          </div>
        </div>
      </main>

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
