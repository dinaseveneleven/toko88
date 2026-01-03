import { ProductVariant } from '@/types/pos';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Package } from 'lucide-react';

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedCode: string | null;
  onSelect: (code: string) => void;
  disabled?: boolean;
}

export function VariantSelector({ variants, selectedCode, onSelect, disabled }: VariantSelectorProps) {
  const selectedVariant = variants.find(v => v.code === selectedCode);

  return (
    <Select
      value={selectedCode || ''}
      onValueChange={onSelect}
      disabled={disabled}
    >
      <SelectTrigger className="w-full h-8 text-xs">
        <SelectValue placeholder="Pilih varian...">
          {selectedVariant && (
            <span className="flex items-center gap-1.5">
              <span>{selectedVariant.name}</span>
              <span className="text-muted-foreground">({selectedVariant.stock})</span>
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {variants.map((variant) => (
          <SelectItem 
            key={variant.code} 
            value={variant.code}
            disabled={variant.stock === 0}
          >
            <div className="flex items-center justify-between gap-3 w-full">
              <span>{variant.name}</span>
              <span className={`flex items-center gap-1 text-xs ${
                variant.stock === 0 
                  ? 'text-destructive' 
                  : variant.stock <= 5 
                    ? 'text-yellow-500' 
                    : 'text-muted-foreground'
              }`}>
                <Package className="w-3 h-3" />
                {variant.stock}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
