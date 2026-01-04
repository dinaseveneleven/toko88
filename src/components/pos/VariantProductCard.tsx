import { useState, useMemo, memo, useCallback } from 'react';
import { Product } from '@/types/pos';
import { Plus, Minus } from 'lucide-react';
import { VariantSelector } from './VariantSelector';
import { cn } from '@/lib/utils';

interface VariantProductCardProps {
  product: Product;
  pricingMode: 'retail' | 'grosir';
  onAdd: (product: Product, quantity: number, variantCode?: string, variantName?: string) => void;
  searchQuery?: string;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

const VariantProductCardComponent = ({ product, pricingMode, onAdd, searchQuery = '' }: VariantProductCardProps) => {
  const [quantity, setQuantity] = useState(1);
  const [inputValue, setInputValue] = useState('1');
  const [selectedVariantCode, setSelectedVariantCode] = useState<string | null>(null);
  
  const variants = product.variants || [];

  // Auto-select variant when search matches variant code/name
  useMemo(() => {
    if (!searchQuery) return;
    const searchLower = searchQuery.toLowerCase().trim();
    if (!searchLower) return;
    
    const matchingVariant = variants.find(
      v => v.code.toLowerCase().includes(searchLower) || 
           v.name.toLowerCase().includes(searchLower)
    );
    
    if (matchingVariant && matchingVariant.code !== selectedVariantCode) {
      setSelectedVariantCode(matchingVariant.code);
    }
  }, [searchQuery, variants, selectedVariantCode]);
  
  const selectedVariant = useMemo(() => {
    if (!selectedVariantCode) return null;
    return variants.find(v => v.code === selectedVariantCode) || null;
  }, [variants, selectedVariantCode]);
  
  const availableStock = selectedVariant ? selectedVariant.stock : product.stock;
  const isOutOfStock = availableStock === 0;
  const isLowStock = availableStock > 0 && availableStock <= 10;
  const allVariantsOutOfStock = variants.every(v => v.stock === 0);
  const isGrosir = pricingMode === 'grosir';
  
  const displayPrice = useMemo(() => {
    if (selectedVariant) {
      if (isGrosir) {
        return selectedVariant.bulkPrice ?? product.bulkPrice;
      }
      return selectedVariant.retailPrice ?? product.retailPrice;
    }
    return isGrosir ? product.bulkPrice : product.retailPrice;
  }, [selectedVariant, isGrosir, product.bulkPrice, product.retailPrice]);

  const handleQuantityChange = useCallback((delta: number) => {
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
    e.target.select();
  }, []);

  const handleAdd = useCallback(() => {
    if (selectedVariant) {
      onAdd(product, quantity, selectedVariant.code, selectedVariant.name);
    }
    setQuantity(1);
    setInputValue('1');
    setSelectedVariantCode(null);
  }, [selectedVariant, onAdd, product, quantity]);

  const isAddDisabled = allVariantsOutOfStock || !selectedVariantCode || isOutOfStock;

  return (
    <div 
      className={cn(
        "group relative h-full rounded-2xl overflow-hidden",
        "bg-card/80 backdrop-blur-sm",
        "border border-border/40",
        "hover:border-border/80 hover:shadow-lg hover:shadow-black/5",
        "active:scale-[0.98]",
        "transition-all duration-300 ease-out",
        "flex flex-col",
        allVariantsOutOfStock && "opacity-50"
      )}
    >
      {/* Content */}
      <div className="flex-1 p-3 sm:p-4 flex flex-col gap-3">
        {/* Header */}
        <div className="space-y-1">
          <h3 className="font-semibold text-foreground text-sm sm:text-base leading-snug line-clamp-2">
            {product.name}
          </h3>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
              {variants.length} varian
            </span>
            {selectedVariant && (
              <span className={cn(
                "inline-flex items-center text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium",
                isOutOfStock
                  ? "bg-destructive/10 text-destructive"
                  : isLowStock
                    ? "bg-warning/10 text-warning"
                    : "bg-secondary text-muted-foreground"
              )}>
                Stok: {selectedVariant.stock}
              </span>
            )}
          </div>
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

        {/* Variant Selector */}
        <VariantSelector
          variants={variants}
          selectedCode={selectedVariantCode}
          onSelect={setSelectedVariantCode}
          disabled={allVariantsOutOfStock}
          product={product}
          priceType={isGrosir ? 'bulk' : 'retail'}
        />

        {/* Quantity Selector - Animated */}
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          selectedVariantCode && !isOutOfStock 
            ? "max-h-20 opacity-100" 
            : "max-h-0 opacity-0"
        )}>
          <div className="flex items-center justify-center gap-2 py-1">
            <button
              type="button"
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center",
                "bg-secondary/60 hover:bg-secondary",
                "active:scale-95",
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
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={cn(
                "w-14 h-9 text-center text-sm font-mono font-medium",
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
              onClick={() => handleQuantityChange(1)}
              disabled={quantity >= availableStock}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center",
                "bg-secondary/60 hover:bg-secondary",
                "active:scale-95",
                "transition-all duration-150",
                "disabled:opacity-30 disabled:cursor-not-allowed"
              )}
            >
              <Plus className="w-4 h-4 text-foreground" />
            </button>
          </div>
        </div>
      </div>

      {/* Add Button */}
      <div className="p-3 sm:p-4 pt-0">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isAddDisabled}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl",
            "font-medium text-sm",
            "active:scale-[0.97]",
            "transition-all duration-200 ease-out",
            "disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100",
            isGrosir 
              ? "bg-pos-bulk/15 text-pos-bulk hover:bg-pos-bulk/25 border border-pos-bulk/30" 
              : "bg-pos-retail/10 text-pos-retail hover:bg-pos-retail/20"
          )}
        >
          <Plus className="w-4 h-4" />
          <span>{!selectedVariantCode ? 'Pilih Varian' : 'Tambah'}</span>
        </button>
      </div>
    </div>
  );
};

export const VariantProductCard = memo(VariantProductCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.stock === nextProps.product.stock &&
    prevProps.product.retailPrice === nextProps.product.retailPrice &&
    prevProps.product.bulkPrice === nextProps.product.bulkPrice &&
    prevProps.pricingMode === nextProps.pricingMode &&
    prevProps.searchQuery === nextProps.searchQuery &&
    JSON.stringify(prevProps.product.variants) === JSON.stringify(nextProps.product.variants)
  );
});
