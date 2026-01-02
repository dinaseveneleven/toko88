import { useState } from 'react';
import { Product } from '@/types/pos';
import { Plus, Package, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProductCardProps {
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

export function ProductCard({ product, pricingMode, onAdd }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [inputValue, setInputValue] = useState('1');
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 10;

  const isGrosir = pricingMode === 'grosir';
  const displayPrice = isGrosir ? product.bulkPrice : product.retailPrice;
  const priceLabel = isGrosir ? 'Grosir' : 'Eceran';
  const accentColor = isGrosir ? 'pos-bulk' : 'pos-retail';

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
    const input = e.target;
    const length = input.value.length;
    setTimeout(() => {
      input.setSelectionRange(length, length);
    }, 0);
  };

  const handleAdd = () => {
    onAdd(product, quantity);
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

      {/* Single price display based on mode */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] sm:text-xs md:text-sm text-${accentColor} font-medium`}>
          {priceLabel}
        </span>
        <span className={`font-mono text-sm sm:text-base md:text-xl text-${accentColor} font-bold`}>
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

      {/* Single add button */}
      <div className="mt-auto">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isOutOfStock}
          className={`w-full flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 md:py-3 min-h-[40px] md:min-h-[48px] rounded-lg bg-${accentColor}/10 hover:bg-${accentColor}/20 active:bg-${accentColor}/30 text-${accentColor} text-xs sm:text-sm md:text-base font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          <Plus className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5" />
          Tambah
        </button>
      </div>
    </div>
  );
}
