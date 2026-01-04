import { useState, memo, useCallback } from 'react';
import { Product } from '@/types/pos';
import { Plus, Package, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
  
  const availableStock = product.stock;
  const isOutOfStock = availableStock === 0;
  const isLowStock = availableStock > 0 && availableStock <= 10;
  const isGrosir = pricingMode === 'grosir';
  const displayPrice = isGrosir ? product.bulkPrice : product.retailPrice;
  const priceLabel = isGrosir ? 'Grosir' : 'Eceran';
  
  const priceClasses = isGrosir ? 'text-pos-bulk' : 'text-pos-retail';
  const buttonClasses = isGrosir 
    ? 'bg-pos-bulk/20 hover:bg-pos-bulk/30 active:bg-pos-bulk/40 text-pos-bulk border border-pos-bulk/50' 
    : 'bg-pos-retail/10 hover:bg-pos-retail/20 active:bg-pos-retail/30 text-pos-retail';

  const handleQuantityChange = useCallback((delta: number) => {
    setQuantity((prev) => {
      const newQty = prev + delta;
      if (newQty < 1) return 1;
      if (newQty > availableStock) return availableStock;
      setInputValue(String(newQty < 1 ? 1 : (newQty > availableStock ? availableStock : newQty)));
      return newQty < 1 ? 1 : (newQty > availableStock ? availableStock : newQty);
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
    if (inputValue === '' || parseInt(inputValue) < 1) {
      setQuantity(1);
      setInputValue('1');
    } else if (parseInt(inputValue) > availableStock) {
      setQuantity(availableStock);
      setInputValue(String(availableStock));
    } else {
      setInputValue(String(quantity));
    }
  }, [inputValue, availableStock, quantity]);

  const handleInputFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const input = e.target;
    const length = input.value.length;
    setTimeout(() => {
      input.setSelectionRange(length, length);
    }, 0);
  }, []);

  const handleAdd = useCallback(() => {
    onAdd(product, quantity);
    setQuantity(1);
    setInputValue('1');
  }, [onAdd, product, quantity]);

  return (
    <div 
      className={`pos-card h-full p-2 sm:p-4 md:p-5 flex flex-col gap-2 sm:gap-3 md:gap-4 active:scale-[0.98] transition-transform ${
        isOutOfStock ? 'opacity-50' : ''
      }`}
    >
      {/* Header: Name + Stock */}
      <div className="flex items-start justify-between gap-1 sm:gap-2 md:gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-xs sm:text-sm md:text-base leading-tight line-clamp-2">
            {product.name}
          </h3>
        </div>
        <div className={`flex items-center gap-0.5 sm:gap-1 text-[10px] sm:text-xs md:text-sm px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 md:py-1.5 rounded-full flex-shrink-0 ${
          isOutOfStock
            ? 'bg-destructive/20 text-destructive' 
            : isLowStock 
              ? 'bg-warning/20 text-warning' 
              : 'bg-secondary text-muted-foreground'
        }`}>
          <Package className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4" />
          <span>{product.stock}</span>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] sm:text-xs md:text-sm ${priceClasses} font-medium`}>
          {priceLabel}
        </span>
        <span className={`font-mono text-sm sm:text-base md:text-xl ${priceClasses} font-bold`}>
          {formatRupiah(displayPrice)}
        </span>
      </div>

      {/* Quantity selector */}
      {!isOutOfStock && (
        <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-3">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-8 sm:w-8 md:h-10 md:w-10 min-h-[32px] min-w-[32px]"
            onClick={() => handleQuantityChange(-1)}
            disabled={quantity <= 1}
          >
            <Minus className="w-3 h-3 md:w-4 md:h-4" />
          </Button>
          <Input
            type="number"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleInputBlur}
            onFocus={handleInputFocus}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-12 sm:w-16 md:w-20 h-8 md:h-10 text-center text-xs sm:text-sm md:text-base font-mono bg-transparent border-input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            min={1}
            max={availableStock}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-8 sm:w-8 md:h-10 md:w-10 min-h-[32px] min-w-[32px]"
            onClick={() => handleQuantityChange(1)}
            disabled={quantity >= availableStock}
          >
            <Plus className="w-3 h-3 md:w-4 md:h-4" />
          </Button>
        </div>
      )}

      {/* Add button */}
      <div className="mt-auto">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className={`w-full flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 md:py-3 min-h-[40px] md:min-h-[48px] rounded-lg ${buttonClasses} text-xs sm:text-sm md:text-base font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          Tambah
        </button>
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
