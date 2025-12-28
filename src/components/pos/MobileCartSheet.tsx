import { CartItem } from '@/types/pos';
import { Minus, Plus, Trash2, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileCartSheetProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (productId: string, priceType: 'retail' | 'bulk', delta: number) => void;
  onSetQuantity: (productId: string, priceType: 'retail' | 'bulk', quantity: number) => void;
  onRemove: (productId: string, priceType: 'retail' | 'bulk') => void;
  onClear: () => void;
  onCheckout: () => void;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

export function MobileCartSheet({ 
  open, 
  onClose, 
  items, 
  onUpdateQuantity, 
  onSetQuantity, 
  onRemove, 
  onClear, 
  onCheckout 
}: MobileCartSheetProps) {
  const subtotal = items.reduce((sum, item) => {
    const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
    return sum + price * item.quantity;
  }, 0);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl bg-card border-border p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <SheetTitle className="font-semibold text-lg">Keranjang</SheetTitle>
              </div>
              <div className="flex items-center gap-3">
                {items.length > 0 && (
                  <button
                    onClick={onClear}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Hapus Semua
                  </button>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-left">
              {totalItems} item{totalItems !== 1 ? 's' : ''}
            </p>
          </SheetHeader>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">Keranjang kosong</p>
                <p className="text-xs">Tambahkan produk untuk mulai</p>
              </div>
            ) : (
              items.map((item) => {
                const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
                const itemTotal = price * item.quantity;
                
                return (
                  <div 
                    key={`${item.product.id}-${item.priceType}`}
                    className="bg-secondary/50 rounded-xl p-3 animate-fade-in"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{item.product.name}</h4>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.priceType === 'retail' 
                            ? 'bg-pos-retail/20 text-pos-retail' 
                            : 'bg-pos-bulk/20 text-pos-bulk'
                        }`}>
                          {item.priceType === 'retail' ? 'Eceran' : 'Grosir'}
                        </span>
                      </div>
                      <button
                        onClick={() => onRemove(item.product.id, item.priceType)}
                        className="p-1.5 rounded-lg hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.priceType, -1)}
                          className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors min-h-[32px]"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            onSetQuantity(item.product.id, item.priceType, val);
                          }}
                          className="w-14 h-8 text-center font-mono text-sm px-1"
                          min={1}
                          max={item.product.stock}
                        />
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.priceType, 1)}
                          disabled={item.quantity >= item.product.stock}
                          className="w-8 h-8 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors disabled:opacity-30 min-h-[32px]"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-mono text-sm font-semibold">
                        {formatRupiah(itemTotal)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border space-y-4 pb-safe">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono text-xl font-bold text-foreground">
                {formatRupiah(subtotal)}
              </span>
            </div>

            <Button
              onClick={() => {
                onClose();
                onCheckout();
              }}
              disabled={items.length === 0}
              className="w-full h-14 text-lg font-semibold pos-glow"
              size="lg"
            >
              Checkout
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
