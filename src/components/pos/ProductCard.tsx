import { useState } from 'react';
import { Product } from '@/types/pos';
import { Plus, Package, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, priceType: 'retail' | 'bulk', quantity: number) => void;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

export function ProductCard({ product, onAdd }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [inputValue, setInputValue] = useState('1');
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 10;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const newQty = prev + delta;
      if (newQty < 1) return 1;
      if (newQty > product.stock) return product.stock;
      setInputValue(String(newQty));
      return newQty;
    });
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    const num = parseInt(value);
    if (!isNaN(num) && num >= 1 && num <= product.stock) {
      setQuantity(num);
    }
  };

  const handleInputBlur = () => {
    if (inputValue === '' || parseInt(inputValue) < 1) {
      setQuantity(1);
      setInputValue('1');
    } else if (parseInt(inputValue) > product.stock) {
      setQuantity(product.stock);
      setInputValue(String(product.stock));
    } else {
      setInputValue(String(quantity));
    }
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Move cursor to end of input for better mobile/tablet UX
    const input = e.target;
    const length = input.value.length;
    setTimeout(() => {
      input.setSelectionRange(length, length);
    }, 0);
  };

  const handleAdd = (priceType: 'retail' | 'bulk') => {
    onAdd(product, priceType, quantity);
    setQuantity(1);
    setInputValue('1');
  };

  return (
    <div 
      className={`pos-card p-2 sm:p-4 md:p-5 flex flex-col gap-2 sm:gap-3 md:gap-4 active:scale-[0.98] transition-transform ${
        isOutOfStock ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-1 sm:gap-2 md:gap-3">
        <h3 className="font-semibold text-foreground text-xs sm:text-sm md:text-base leading-tight line-clamp-2">
          {product.name}
        </h3>
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

      <div className="flex flex-col gap-0.5 sm:gap-1 md:gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Eceran</span>
          <span className="font-mono text-xs sm:text-sm md:text-lg text-pos-retail font-semibold">
            {formatRupiah(product.retailPrice)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs md:text-sm text-muted-foreground">Grosir</span>
          <span className="font-mono text-xs sm:text-sm md:text-lg text-pos-bulk font-semibold">
            {formatRupiah(product.bulkPrice)}
          </span>
        </div>
      </div>

      {/* Quantity selector - touch-friendly sizes */}
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
            max={product.stock}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-8 sm:w-8 md:h-10 md:w-10 min-h-[32px] min-w-[32px]"
            onClick={() => handleQuantityChange(1)}
            disabled={quantity >= product.stock}
          >
            <Plus className="w-3 h-3 md:w-4 md:h-4" />
          </Button>
        </div>
      )}

      {/* Add buttons - touch-friendly with min heights */}
      <div className="flex gap-1 sm:gap-2 md:gap-3 mt-auto">
        <button
          onClick={() => handleAdd('retail')}
          disabled={isOutOfStock}
          className="flex-1 flex items-center justify-center gap-0.5 sm:gap-1 md:gap-2 py-2 sm:py-2 md:py-3 min-h-[40px] md:min-h-[48px] rounded-lg bg-pos-retail/10 hover:bg-pos-retail/20 active:bg-pos-retail/30 text-pos-retail text-[10px] sm:text-xs md:text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4" />
          Eceran
        </button>
        <button
          onClick={() => handleAdd('bulk')}
          disabled={isOutOfStock}
          className="flex-1 flex items-center justify-center gap-0.5 sm:gap-1 md:gap-2 py-2 sm:py-2 md:py-3 min-h-[40px] md:min-h-[48px] rounded-lg bg-pos-bulk/10 hover:bg-pos-bulk/20 active:bg-pos-bulk/30 text-pos-bulk text-[10px] sm:text-xs md:text-sm font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4" />
          Grosir
        </button>
      </div>
    </div>
  );
}
