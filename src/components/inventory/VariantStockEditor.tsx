import { useState, useCallback, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Minus, ChevronDown, ChevronUp } from 'lucide-react';
import { ProductVariant, Product } from '@/types/pos';
import { cn } from '@/lib/utils';

const formatRupiah = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface VariantStockEditorProps {
  productId: string;
  productName: string;
  variants: ProductVariant[];
  product: Product;
  onUpdateVariantStock: (productId: string, variantCode: string, stock: number) => Promise<void>;
  onUpdateVariantInventory?: (productId: string, variantCode: string, stock: number, retailPrice?: number, bulkPrice?: number) => Promise<void> | Promise<boolean>;
  savingVariantKeys: Set<string>;
  highlightedVariantCodes?: string[]; // Variant codes to highlight (from search)
}

const DEBOUNCE_MS = 600;

export function VariantStockEditor({
  productId,
  productName,
  variants,
  product,
  onUpdateVariantStock,
  onUpdateVariantInventory,
  savingVariantKeys,
  highlightedVariantCodes = [],
}: VariantStockEditorProps) {
  // Auto-expand if there are highlighted variants
  const [isExpanded, setIsExpanded] = useState(highlightedVariantCodes.length > 0);
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({});
  const [editedRetailPrices, setEditedRetailPrices] = useState<Record<string, number | undefined>>({});
  const [editedBulkPrices, setEditedBulkPrices] = useState<Record<string, number | undefined>>({});
  const debounceRefs = useRef<Record<string, NodeJS.Timeout>>({});

  // Auto-expand when highlighted variants change
  useEffect(() => {
    if (highlightedVariantCodes.length > 0) {
      setIsExpanded(true);
    }
  }, [highlightedVariantCodes]);

  // Initialize edited values from variants
  useEffect(() => {
    const stocks: Record<string, number> = {};
    const retailPrices: Record<string, number | undefined> = {};
    const bulkPrices: Record<string, number | undefined> = {};
    variants.forEach((v) => {
      stocks[v.code] = v.stock;
      retailPrices[v.code] = v.retailPrice;
      bulkPrices[v.code] = v.bulkPrice;
    });
    setEditedStocks(stocks);
    setEditedRetailPrices(retailPrices);
    setEditedBulkPrices(bulkPrices);
  }, [variants]);

  // Cleanup debounce timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceRefs.current).forEach(clearTimeout);
    };
  }, []);

  const saveVariant = useCallback(
    (variantCode: string) => {
      const stock = editedStocks[variantCode] ?? 0;
      const retailPrice = editedRetailPrices[variantCode];
      const bulkPrice = editedBulkPrices[variantCode];
      
      if (onUpdateVariantInventory) {
        onUpdateVariantInventory(productId, variantCode, stock, retailPrice, bulkPrice);
      } else {
        onUpdateVariantStock(productId, variantCode, stock);
      }
    },
    [productId, editedStocks, editedRetailPrices, editedBulkPrices, onUpdateVariantInventory, onUpdateVariantStock]
  );

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
        saveVariant(variantCode);
      }, DEBOUNCE_MS);
    },
    [saveVariant]
  );

  const handlePriceChange = useCallback(
    (variantCode: string, type: 'retail' | 'bulk', value: string) => {
      const parsed = parseInt(value, 10);
      const safeValue = isNaN(parsed) || value === '' ? undefined : Math.max(0, parsed);

      if (type === 'retail') {
        setEditedRetailPrices((prev) => ({ ...prev, [variantCode]: safeValue }));
      } else {
        setEditedBulkPrices((prev) => ({ ...prev, [variantCode]: safeValue }));
      }

      // Clear previous debounce
      const debounceKey = `${variantCode}_${type}`;
      if (debounceRefs.current[debounceKey]) {
        clearTimeout(debounceRefs.current[debounceKey]);
      }

      // Set new debounce
      debounceRefs.current[debounceKey] = setTimeout(() => {
        saveVariant(variantCode);
      }, DEBOUNCE_MS);
    },
    [saveVariant]
  );

  const handleBlur = useCallback(
    (variantCode: string, type: 'stock' | 'retail' | 'bulk' = 'stock') => {
      // Clear debounce and save immediately
      const debounceKey = type === 'stock' ? variantCode : `${variantCode}_${type}`;
      if (debounceRefs.current[debounceKey]) {
        clearTimeout(debounceRefs.current[debounceKey]);
        delete debounceRefs.current[debounceKey];
      }

      const originalVariant = variants.find((v) => v.code === variantCode);
      if (!originalVariant) return;

      const currentStock = editedStocks[variantCode] ?? 0;
      const currentRetail = editedRetailPrices[variantCode];
      const currentBulk = editedBulkPrices[variantCode];
      
      const hasChanges = 
        currentStock !== originalVariant.stock ||
        currentRetail !== originalVariant.retailPrice ||
        currentBulk !== originalVariant.bulkPrice;

      if (hasChanges) {
        saveVariant(variantCode);
      }
    },
    [variants, editedStocks, editedRetailPrices, editedBulkPrices, saveVariant]
  );

  const handleIncrement = useCallback(
    (variantCode: string) => {
      const current = editedStocks[variantCode] ?? 0;
      const newStock = current + 1;
      setEditedStocks((prev) => ({ ...prev, [variantCode]: newStock }));
      
      if (onUpdateVariantInventory) {
        onUpdateVariantInventory(productId, variantCode, newStock, editedRetailPrices[variantCode], editedBulkPrices[variantCode]);
      } else {
        onUpdateVariantStock(productId, variantCode, newStock);
      }
    },
    [productId, editedStocks, editedRetailPrices, editedBulkPrices, onUpdateVariantInventory, onUpdateVariantStock]
  );

  const handleDecrement = useCallback(
    (variantCode: string) => {
      const current = editedStocks[variantCode] ?? 0;
      const newStock = Math.max(0, current - 1);
      setEditedStocks((prev) => ({ ...prev, [variantCode]: newStock }));
      
      if (onUpdateVariantInventory) {
        onUpdateVariantInventory(productId, variantCode, newStock, editedRetailPrices[variantCode], editedBulkPrices[variantCode]);
      } else {
        onUpdateVariantStock(productId, variantCode, newStock);
      }
    },
    [productId, editedStocks, editedRetailPrices, editedBulkPrices, onUpdateVariantInventory, onUpdateVariantStock]
  );

  const totalStock = variants.reduce((sum, v) => sum + (editedStocks[v.code] ?? v.stock), 0);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 text-sm hover:underline",
          highlightedVariantCodes.length > 0 ? "text-primary font-medium" : "text-primary"
        )}
      >
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        <span>{variants.length} varian (Total: {totalStock})</span>
        {highlightedVariantCodes.length > 0 && (
          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
            {highlightedVariantCodes.length} cocok
          </span>
        )}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2 pl-4 border-l-2 border-primary/20">
          {variants.map((variant) => {
            const variantKey = `${productId}|${variant.code}`;
            const isSaving = savingVariantKeys.has(variantKey);
            const currentStock = editedStocks[variant.code] ?? variant.stock;
            const isLowStock = currentStock > 0 && currentStock <= 5;
            const isOutOfStock = currentStock === 0;
            const isHighlighted = highlightedVariantCodes.includes(variant.code);
            
            // Get variant-specific prices or fallback to product prices
            const retailPrice = variant.retailPrice ?? product.retailPrice;
            const bulkPrice = variant.bulkPrice ?? product.bulkPrice;

            return (
              <div
                key={variant.code}
                className={cn(
                  "py-2 px-3 rounded-lg transition-all",
                  isHighlighted 
                    ? "bg-primary/10 border-2 border-primary/30 ring-2 ring-primary/20" 
                    : "bg-secondary/30"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <span className={cn("text-sm font-medium", isHighlighted && "text-primary")}>
                      {variant.name}
                    </span>
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
                        onBlur={() => handleBlur(variant.code, 'stock')}
                        className={cn(
                          "w-14 text-center font-mono text-sm h-7 pr-4 placeholder:text-muted-foreground/40",
                          isOutOfStock ? 'text-destructive' : isLowStock ? 'text-yellow-600 dark:text-yellow-500' : ''
                        )}
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
                
                {/* Price editors */}
                <div className="flex gap-3 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Eceran:</span>
                    <Input
                      type="number"
                      value={editedRetailPrices[variant.code] ?? ''}
                      placeholder={product.retailPrice.toString()}
                      onChange={(e) => handlePriceChange(variant.code, 'retail', e.target.value)}
                      onBlur={() => handleBlur(variant.code, 'retail')}
                      className="w-24 font-mono text-xs h-7 placeholder:text-muted-foreground/40"
                      min={0}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Grosir:</span>
                    <Input
                      type="number"
                      value={editedBulkPrices[variant.code] ?? ''}
                      placeholder={product.bulkPrice.toString()}
                      onChange={(e) => handlePriceChange(variant.code, 'bulk', e.target.value)}
                      onBlur={() => handleBlur(variant.code, 'bulk')}
                      className="w-24 font-mono text-xs h-7 placeholder:text-muted-foreground/40"
                      min={0}
                      disabled={isSaving}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}