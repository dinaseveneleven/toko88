import { useState, memo, useCallback } from 'react';
import { Product } from '@/types/pos';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SimpleProductCardProps {
  product: Product;
  pricingMode: 'retail' | 'grosir';
  onAdd: (product: Product, quantity: number) => void;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

const SimpleProductCardComponent = ({ product, pricingMode, onAdd }: SimpleProductCardProps) => {
  const [quantity, setQuantity] = useState(1);
  const [inputValue, setInputValue] = useState('1');
  const [isPressed, setIsPressed] = useState(false);
  
  const availableStock = product.stock;
  const isOutOfStock = availableStock === 0;
  const isLowStock = availableStock > 0 && availableStock <= 10;
  const isGrosir = pricingMode === 'grosir';
  const displayPrice = isGrosir ? product.bulkPrice : product.retailPrice;

  const handleQuantityChange = useCallback((delta: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setQuantity((prev) => {
      const newQty = Math.max(1, Math.min(prev + delta, availableStock));
      setInputValue(String(newQty));
      return newQty;
    });
  }, [availableStock]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= availableStock) {
      setQuantity(num);
    }
  }, [availableStock]);

  const handleInputBlur = useCallback(() => {
    const num = parseInt(inputValue);
    if (isNaN(num) || num < 1) {
      setQuantity(1);
      setInputValue('1');
    } else if (num > availableStock) {
      setQuantity(availableStock);
      setInputValue(String(availableStock));
    } else {
      setInputValue(String(quantity));
    }
  }, [inputValue, availableStock, quantity]);

  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.target.select();
  }, []);

  const handleInputClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleAdd = useCallback(() => {
    if (isOutOfStock) return;
    onAdd(product, quantity);
    setQuantity(1);
    setInputValue('1');
  }, [onAdd, product, quantity, isOutOfStock]);

  const handleCardClick = useCallback(() => {
    if (isOutOfStock) return;
    handleAdd();
  }, [isOutOfStock, handleAdd]);

  return (
    <div 
      onClick={handleCardClick}
      onMouseDown={() => !isOutOfStock && setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      onTouchStart={() => !isOutOfStock && setIsPressed(true)}
      onTouchEnd={() => setIsPressed(false)}
      className={cn(
        "group relative h-full rounded-2xl overflow-hidden cursor-pointer select-none",
        "bg-card/80 backdrop-blur-sm",
        "border border-border/40",
        "hover:border-border/80 hover:shadow-lg hover:shadow-black/5",
        "transition-all duration-200 ease-out",
        "flex flex-col",
        isOutOfStock && "opacity-50 cursor-not-allowed",
        isPressed && !isOutOfStock && "scale-[0.97] shadow-inner bg-primary/5"
      )}
    >
      {/* Quick Add Indicator */}
      {!isOutOfStock && (
        <div className={cn(
          "absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center",
          "bg-primary/10 text-primary",
          "opacity-0 group-hover:opacity-100",
          "transition-opacity duration-200"
        )}>
          <ShoppingCart className="w-3.5 h-3.5" />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="space-y-1.5">
          <h3 className="font-semibold text-foreground text-sm sm:text-base leading-snug line-clamp-2 pr-8">
            {product.name}
          </h3>
          <span className={cn(
            "inline-flex items-center text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium",
            isOutOfStock
              ? "bg-destructive/10 text-destructive"
              : isLowStock
                ? "bg-warning/10 text-warning"
                : "bg-secondary text-muted-foreground"
          )}>
            Stok: {product.stock}
          </span>
        </div>

        {/* Price Display */}
        <div className="flex items-baseline justify-between">
          <span className={cn(
            "text-xs font-medium",
            isGrosir ? "text-pos-bulk" : "text-pos-retail"
          )}>
            {isGrosir ? 'Grosir' : 'Eceran'}
          </span>
          <span className={cn(
            "font-mono text-lg sm:text-xl font-bold tracking-tight",
            isGrosir ? "text-pos-bulk" : "text-pos-retail"
          )}>
            {formatRupiah(displayPrice)}
          </span>
        </div>

        {/* Quantity Selector - Interactive Zone */}
        {!isOutOfStock && (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 py-1 mt-auto"
          >
            <button
              type="button"
              onClick={(e) => handleQuantityChange(-1, e)}
              disabled={quantity <= 1}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                "bg-secondary/60 hover:bg-secondary",
                "active:scale-95 active:bg-secondary",
                "transition-all duration-150",
                "disabled:opacity-30 disabled:cursor-not-allowed"
              )}
            >
              <Minus className="w-4 h-4 text-foreground" />
            </button>
            
            <input
              type="number"
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
              onFocus={handleInputFocus}
              onClick={handleInputClick}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={cn(
                "w-14 h-10 text-center text-sm font-mono font-medium",
                "bg-secondary/40 border border-border/50 rounded-xl",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
                "transition-all duration-150",
                "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              )}
              min={1}
              max={availableStock}
            />
            
            <button
              type="button"
              onClick={(e) => handleQuantityChange(1, e)}
              disabled={quantity >= availableStock}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                "bg-secondary/60 hover:bg-secondary",
                "active:scale-95 active:bg-secondary",
                "transition-all duration-150",
                "disabled:opacity-30 disabled:cursor-not-allowed"
              )}
            >
              <Plus className="w-4 h-4 text-foreground" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const SimpleProductCard = memo(SimpleProductCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.stock === nextProps.product.stock &&
    prevProps.product.retailPrice === nextProps.product.retailPrice &&
    prevProps.product.bulkPrice === nextProps.product.bulkPrice &&
    prevProps.pricingMode === nextProps.pricingMode
  );
});
