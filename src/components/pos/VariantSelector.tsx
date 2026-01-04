import { ProductVariant, Product } from '@/types/pos';
import { useState } from 'react';
import { Check, ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

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

  const selectedPrice = selectedVariant ? getVariantPrice(selectedVariant) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full h-9 justify-between text-xs font-normal",
            "bg-secondary/50 border-border/50 hover:bg-secondary/80",
            !selectedVariant && "text-muted-foreground"
          )}
        >
          {selectedVariant ? (
            <span className="flex items-center gap-2 truncate w-full">
              <span className="truncate flex-1 text-left">{selectedVariant.name}</span>
              <span className="font-mono text-[10px] text-primary shrink-0">
                {formatRupiah(selectedPrice || 0)}
              </span>
              <span className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                selectedVariant.stock === 0 
                  ? "bg-destructive/20 text-destructive"
                  : selectedVariant.stock <= 5
                    ? "bg-warning/20 text-warning"
                    : "bg-muted text-muted-foreground"
              )}>
                {selectedVariant.stock}
              </span>
            </span>
          ) : (
            <span>Pilih varian...</span>
          )}
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-1 bg-popover border-border shadow-lg z-50" 
        align="start"
        sideOffset={4}
      >
        <div className="max-h-[200px] overflow-y-auto">
          {variants.map((variant) => {
            const isSelected = variant.code === selectedCode;
            const isOutOfStock = variant.stock === 0;
            const isLowStock = variant.stock > 0 && variant.stock <= 5;
            const variantPrice = getVariantPrice(variant);
            
            return (
              <button
                key={variant.code}
                onClick={() => !isOutOfStock && handleSelect(variant.code)}
                disabled={isOutOfStock}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-2 text-xs rounded-sm transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-accent",
                  isOutOfStock && "opacity-40 cursor-not-allowed"
                )}
              >
                <div className={cn(
                  "w-4 h-4 rounded-full border flex items-center justify-center shrink-0",
                  isSelected 
                    ? "border-primary bg-primary text-primary-foreground" 
                    : "border-muted-foreground/30"
                )}>
                  {isSelected && <Check className="w-2.5 h-2.5" />}
                </div>
                <span className="flex-1 text-left truncate">{variant.name}</span>
                <span className="font-mono text-[10px] text-primary shrink-0">
                  {formatRupiah(variantPrice)}
                </span>
                <span className={cn(
                  "flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full shrink-0",
                  isOutOfStock 
                    ? "bg-destructive/20 text-destructive"
                    : isLowStock
                      ? "bg-warning/20 text-warning"
                      : "bg-muted text-muted-foreground"
                )}>
                  <Package className="w-2.5 h-2.5" />
                  {variant.stock}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}