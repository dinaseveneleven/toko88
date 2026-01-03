import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { ProductVariant } from '@/types/pos';

interface VariantStockEditorProps {
  productId: string;
  productName: string;
  variants: ProductVariant[];
  onUpdateVariantStock: (productId: string, variantCode: string, stock: number) => Promise<void>;
  savingVariantKeys: Set<string>;
}

const DEBOUNCE_MS = 600;

export function VariantStockEditor({
  productId,
  productName,
  variants,
  onUpdateVariantStock,
  savingVariantKeys,
}: VariantStockEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({});
  const debounceRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Initialize edited stocks from variants
  useEffect(() => {
    const stocks: Record<string, number> = {};
    variants.forEach((v) => {
      stocks[v.code] = v.stock;
    });
    setEditedStocks(stocks);
  }, [variants]);

  // Cleanup debounce timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceRefs.current).forEach(clearTimeout);
    };
  }, []);

  const handleStockChange = useCallback(
    (variantCode: string, value: string) => {
      const parsed = parseInt(value, 10);
      const safeValue = isNaN(parsed) ? 0 : Math.max(0, parsed);

      setEditedStocks((prev) => ({ ...prev, [variantCode]: safeValue }));

      // Clear previous debounce
      if (debounceRefs.current[variantCode]) {
        clearTimeout(debounceRefs.current[variantCode]);
      }

      // Set new debounce
      debounceRefs.current[variantCode] = setTimeout(() => {
        onUpdateVariantStock(productId, variantCode, safeValue);
      }, DEBOUNCE_MS);
    },
    [productId, onUpdateVariantStock]
  );

  const handleBlur = useCallback(
    (variantCode: string) => {
      // Clear debounce and save immediately
      if (debounceRefs.current[variantCode]) {
        clearTimeout(debounceRefs.current[variantCode]);
        delete debounceRefs.current[variantCode];
      }

      const currentStock = editedStocks[variantCode] ?? 0;
      const originalVariant = variants.find((v) => v.code === variantCode);

      if (originalVariant && currentStock !== originalVariant.stock) {
        onUpdateVariantStock(productId, variantCode, currentStock);
      }
    },
    [productId, variants, editedStocks, onUpdateVariantStock]
  );

  const handleIncrement = useCallback(
    (variantCode: string) => {
      const current = editedStocks[variantCode] ?? 0;
      const newStock = current + 1;
      setEditedStocks((prev) => ({ ...prev, [variantCode]: newStock }));
      onUpdateVariantStock(productId, variantCode, newStock);
    },
    [productId, editedStocks, onUpdateVariantStock]
  );

  const handleDecrement = useCallback(
    (variantCode: string) => {
      const current = editedStocks[variantCode] ?? 0;
      const newStock = Math.max(0, current - 1);
      setEditedStocks((prev) => ({ ...prev, [variantCode]: newStock }));
      onUpdateVariantStock(productId, variantCode, newStock);
    },
    [productId, editedStocks, onUpdateVariantStock]
  );

  const totalStock = variants.reduce((sum, v) => sum + (editedStocks[v.code] ?? v.stock), 0);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-primary hover:underline"
      >
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        <span>{variants.length} varian (Total: {totalStock})</span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-primary/20">
          {variants.map((variant) => {
            const variantKey = `${productId}|${variant.code}`;
            const isSaving = savingVariantKeys.has(variantKey);
            const currentStock = editedStocks[variant.code] ?? variant.stock;
            const isLowStock = currentStock > 0 && currentStock <= 5;
            const isOutOfStock = currentStock === 0;

            return (
              <div
                key={variant.code}
                className="flex items-center justify-between gap-3 py-2 px-3 bg-secondary/30 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{variant.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">({variant.code})</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDecrement(variant.code)}
                    disabled={isSaving}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>

                  <div className="relative">
                    <Input
                      type="number"
                      value={currentStock === 0 ? '' : currentStock}
                      placeholder="0"
                      onChange={(e) => handleStockChange(variant.code, e.target.value)}
                      onBlur={() => handleBlur(variant.code)}
                      className={`w-14 text-center font-mono text-sm h-7 pr-4 placeholder:text-muted-foreground/40 ${
                        isOutOfStock
                          ? 'text-destructive'
                          : isLowStock
                          ? 'text-yellow-600 dark:text-yellow-500'
                          : ''
                      }`}
                      min={0}
                      disabled={isSaving}
                    />
                    {isSaving && (
                      <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleIncrement(variant.code)}
                    disabled={isSaving}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
