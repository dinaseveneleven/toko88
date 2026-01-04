import { useState, memo, useCallback } from 'react';
import { Product } from '@/types/pos';
import { Plus, Minus, Package } from 'lucide-react';
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
        "pos-card h-full p-3 sm:p-5 md:p-6 flex flex-col gap-3 sm:gap-4 cursor-pointer select-none",
        "transition-all duration-200 ease-out min-h-[140px] sm:min-h-[220px] md:min-h-[260px]",
        "border-l-4",
        isGrosir ? "border-l-pos-bulk" : "border-l-pos-retail",
        isOutOfStock && "opacity-50 cursor-not-allowed",
        isPressed && !isOutOfStock && "scale-[0.97]"
      )}
    >
      {/* Header: Name + Stock */}
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-xs sm:text-base md:text-lg leading-snug line-clamp-2">
            {product.name}
          </h3>
        </div>
        <div className={cn(
          "flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-sm px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-full flex-shrink-0",
          isOutOfStock
            ? "bg-destructive/20 text-destructive"
            : isLowStock
              ? "bg-warning/20 text-warning"
              : "bg-secondary text-muted-foreground"
        )}>
          <Package className="w-3 h-3 sm:w-4 sm:h-4" />
          <span className="font-medium">{product.stock}</span>
        </div>
      </div>

      {/* Price - Centered with color accent */}
      <div className="flex-1 flex items-center justify-center">
        <span className={cn(
          "font-mono text-xl sm:text-2xl md:text-3xl font-bold",
          isGrosir ? "text-pos-bulk" : "text-pos-retail"
        )}>
          {formatRupiah(displayPrice)}
        </span>
      </div>

      {/* Quantity Selector - Interactive Zone */}
      {!isOutOfStock && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center gap-2 sm:gap-3"
        >
          <button
            type="button"
            onClick={(e) => handleQuantityChange(-1, e)}
            disabled={quantity <= 1}
            className={cn(
              "h-8 w-8 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl flex items-center justify-center",
              "bg-secondary/60 hover:bg-secondary border border-border/50",
              "active:scale-95",
              "transition-all duration-150",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <Minus className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-foreground" />
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
              "w-12 sm:w-20 h-8 sm:h-12 text-center text-xs sm:text-base font-mono font-medium",
              "bg-transparent border border-border/50 rounded-lg sm:rounded-xl",
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
              "h-8 w-8 sm:h-12 sm:w-12 rounded-lg sm:rounded-xl flex items-center justify-center",
              "bg-secondary/60 hover:bg-secondary border border-border/50",
              "active:scale-95",
              "transition-all duration-150",
              "disabled:opacity-30 disabled:cursor-not-allowed"
            )}
          >
            <Plus className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-foreground" />
          </button>
        </div>
      )}
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
