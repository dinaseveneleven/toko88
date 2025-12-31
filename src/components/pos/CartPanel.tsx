import { useState } from 'react';
import { CartItem } from '@/types/pos';
import { Minus, Plus, Trash2, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

// Separate component for quantity input to manage local state
interface QuantityInputProps {
  item: CartItem;
  onSetQuantity: (productId: string, priceType: 'retail' | 'bulk', quantity: number) => void;
}

function QuantityInput({ item, onSetQuantity }: QuantityInputProps) {
  const [localValue, setLocalValue] = useState<string>(String(item.quantity));

  // Sync local value when item.quantity changes from external source (e.g., +/- buttons)
  if (String(item.quantity) !== localValue && localValue !== '') {
    setLocalValue(String(item.quantity));
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow empty string for typing, don't commit yet
    setLocalValue(e.target.value);
  };

  const handleBlur = () => {
    const parsed = parseInt(localValue);
    if (!isNaN(parsed) && parsed >= 1) {
      const clamped = Math.min(parsed, item.product.stock);
      onSetQuantity(item.product.id, item.priceType, clamped);
      setLocalValue(String(clamped));
    } else {
      // Revert to original quantity if invalid
      setLocalValue(String(item.quantity));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <Input
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onFocus={(e) => {
        const input = e.target;
        setTimeout(() => {
          input.select();
        }, 0);
      }}
      className="w-16 h-7 text-left font-mono text-sm px-2"
      min={1}
      max={item.product.stock}
    />
  );
}

interface CartPanelProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, priceType: 'retail' | 'bulk', delta: number) => void;
  onSetQuantity: (productId: string, priceType: 'retail' | 'bulk', quantity: number) => void;
  onSetDiscount: (productId: string, priceType: 'retail' | 'bulk', discount: number) => void;
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

export function CartPanel({ items, onUpdateQuantity, onSetQuantity, onSetDiscount, onRemove, onClear, onCheckout }: CartPanelProps) {
  const subtotal = items.reduce((sum, item) => {
    const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
    const discount = item.discount || 0;
    const discountedTotal = (price * item.quantity) - discount;
    return sum + Math.max(0, discountedTotal);
  }, 0);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-full flex flex-col bg-pos-cart rounded-2xl border border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-lg">Keranjang</h2>
          </div>
          {items.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              Hapus Semua
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {totalItems} item{totalItems !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Cart Items */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Keranjang kosong</p>
              <p className="text-xs">Tambahkan produk untuk mulai</p>
          </div>
        ) : (
          items.map((item) => {
            const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
            const discount = item.discount || 0;
            const originalTotal = price * item.quantity;
            const itemTotal = Math.max(0, originalTotal - discount);
            
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

                {/* Discount input row - now in Rupiah */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">Disc:</span>
                  <span className="text-xs text-muted-foreground">Rp</span>
                  <Input
                    type="number"
                    value={discount || ''}
                    onChange={(e) => {
                      const val = Math.min(Math.max(0, parseInt(e.target.value) || 0), originalTotal);
                      onSetDiscount(item.product.id, item.priceType, val);
                    }}
                    placeholder="0"
                    className="w-24 h-6 text-right font-mono text-xs px-1"
                    min={0}
                    max={originalTotal}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, item.priceType, -1)}
                      className="w-7 h-7 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <QuantityInput item={item} onSetQuantity={onSetQuantity} />
                    <button
                      onClick={() => onUpdateQuantity(item.product.id, item.priceType, 1)}
                      disabled={item.quantity >= item.product.stock}
                      className="w-7 h-7 rounded-lg bg-secondary hover:bg-secondary/80 flex items-center justify-center transition-colors disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-semibold">
                      {formatRupiah(itemTotal)}
                    </span>
                    {discount > 0 && (
                      <div className="text-xs text-muted-foreground line-through">
                        {formatRupiah(originalTotal)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
            })
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-mono text-xl font-bold text-foreground">
            {formatRupiah(subtotal)}
          </span>
        </div>

        <Button
          onClick={onCheckout}
          disabled={items.length === 0}
          className="w-full h-14 text-lg font-semibold pos-glow"
          size="lg"
        >
          Checkout
        </Button>
      </div>
    </div>
  );
}
