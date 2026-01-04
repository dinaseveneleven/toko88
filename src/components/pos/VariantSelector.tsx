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
            "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl",
            "bg-secondary/40 backdrop-blur-sm",
            "border border-border/50",
            "hover:bg-secondary/60 hover:border-border",
            "active:scale-[0.98]",
            "transition-all duration-200 ease-out",
            "text-sm text-left",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40",
            disabled && "opacity-40 cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "truncate flex-1 min-w-0 font-medium",
              selectedVariant ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {selectedVariant ? selectedVariant.name : "Pilih Varian"}
          </span>

          <ChevronDown 
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )} 
          />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] p-1.5 bg-card/95 backdrop-blur-xl border-border/60 shadow-2xl rounded-xl z-50" 
        align="start"
        sideOffset={6}
      >
        <div className="max-h-[240px] overflow-y-auto space-y-1 scrollbar-hide">
          {variants.map((variant, index) => {
            const isSelected = variant.code === selectedCode;
            const isOutOfStock = variant.stock === 0;
            const variantPrice = getVariantPrice(variant);
            
            return (
              <button
                key={variant.code}
                onClick={() => !isOutOfStock && handleSelect(variant.code)}
                disabled={isOutOfStock}
                style={{ animationDelay: `${index * 30}ms` }}
                className={cn(
                  "w-full rounded-lg transition-all duration-150 ease-out animate-fade-in",
                  "hover:bg-primary/5 active:scale-[0.98]",
                  isSelected && "bg-primary/10",
                  isOutOfStock && "opacity-35 cursor-not-allowed"
                )}
              >
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                  {/* Left: Checkbox + Name */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-150",
                        isSelected 
                          ? "border-primary bg-primary scale-110" 
                          : "border-muted-foreground/30 bg-transparent"
                      )}
                    >
                      {isSelected && (
                        <Check className="w-2.5 h-2.5 text-primary-foreground animate-scale-in" />
                      )}
                    </div>
                    <span className={cn(
                      "text-sm truncate transition-colors",
                      isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                    )}>
                      {variant.name}
                    </span>
                  </div>

                  {/* Right: Price + Stock */}
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs text-muted-foreground/80">
                      {formatRupiah(variantPrice)}
                    </span>
                    <span
                      className={cn(
                        "text-xs tabular-nums font-medium min-w-[20px] text-right px-1.5 py-0.5 rounded-md",
                        isOutOfStock
                          ? "text-destructive bg-destructive/10"
                          : variant.stock <= 5
                            ? "text-warning bg-warning/10"
                            : "text-muted-foreground bg-secondary/50"
                      )}
                    >
                      {variant.stock}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
