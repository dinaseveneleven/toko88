import { ProductVariant, Product } from '@/types/pos';
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
  disabled?: boolean;
  product: Product;
  priceType?: 'retail' | 'bulk';
}

export function VariantSelector({ variants, selectedCode, onSelect, disabled, product, priceType = 'retail' }: VariantSelectorProps) {
  const [open, setOpen] = useState(false);
  const selectedVariant = variants.find(v => v.code === selectedCode);

  const handleSelect = (code: string) => {
    onSelect(code);
    setOpen(false);
  };

  // Get price for a variant (uses variant price if set, otherwise product price)
  const getVariantPrice = (variant: ProductVariant) => {
    if (priceType === 'bulk') {
      return variant.bulkPrice ?? product.bulkPrice;
    }
    return variant.retailPrice ?? product.retailPrice;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-lg",
            "bg-secondary/30 hover:bg-secondary/50 transition-colors",
            "text-sm text-left",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span className={cn(
            "truncate",
            selectedVariant ? "text-foreground" : "text-muted-foreground"
          )}>
            {selectedVariant ? selectedVariant.name : "Pilih varian..."}
          </span>
          <div className="flex items-center gap-2 shrink-0 ml-2">
            {selectedVariant && (
              <span className="font-mono text-xs text-muted-foreground">
                {formatRupiah(getVariantPrice(selectedVariant))}
              </span>
            )}
            {selectedVariant && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {selectedVariant.stock}
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-1.5 bg-card border-border shadow-xl z-50" 
        align="start"
        sideOffset={4}
      >
        <div className="max-h-[200px] overflow-y-auto space-y-0.5">
          {variants.map((variant) => {
            const isSelected = variant.code === selectedCode;
            const isOutOfStock = variant.stock === 0;
            const variantPrice = getVariantPrice(variant);
            
            return (
              <button
                key={variant.code}
                onClick={() => !isOutOfStock && handleSelect(variant.code)}
                disabled={isOutOfStock}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors",
                  "hover:bg-secondary/50",
                  isSelected && "bg-secondary",
                  isOutOfStock && "opacity-40 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                    isSelected 
                      ? "border-primary bg-primary" 
                      : "border-muted-foreground/40"
                  )}>
                    {isSelected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                  </div>
                  <span className="text-sm truncate text-foreground">{variant.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatRupiah(variantPrice)}
                  </span>
                  <span className={cn(
                    "text-xs tabular-nums min-w-[24px] text-right",
                    isOutOfStock 
                      ? "text-destructive"
                      : variant.stock <= 5
                        ? "text-warning"
                        : "text-muted-foreground"
                  )}>
                    {variant.stock}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
