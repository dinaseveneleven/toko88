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
  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 10;

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const newQty = prev + delta;
      if (newQty < 1) return 1;
      if (newQty > product.stock) return product.stock;
      return newQty;
    });
  };

  const handleInputChange = (value: string) => {
    const num = parseInt(value) || 1;
    if (num < 1) setQuantity(1);
    else if (num > product.stock) setQuantity(product.stock);
    else setQuantity(num);
  };

  const handleAdd = (priceType: 'retail' | 'bulk') => {
    onAdd(product, priceType, quantity);
    setQuantity(1); // Reset after adding
  };

  return (
    <div 
      className={`pos-card p-4 flex flex-col gap-3 ${
        isOutOfStock ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">
          {product.name}
        </h3>
        <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
          isOutOfStock 
            ? 'bg-destructive/20 text-destructive' 
            : isLowStock 
              ? 'bg-warning/20 text-warning' 
              : 'bg-secondary text-muted-foreground'
        }`}>
          <Package className="w-3 h-3" />
          <span>{product.stock}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Eceran</span>
          <span className="font-mono text-sm text-pos-retail font-semibold">
            {formatRupiah(product.retailPrice)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Grosir</span>
          <span className="font-mono text-sm text-pos-bulk font-semibold">
            {formatRupiah(product.bulkPrice)}
          </span>
        </div>
      </div>

      {/* Quantity selector */}
      {!isOutOfStock && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleQuantityChange(-1)}
            disabled={quantity <= 1}
          >
            <Minus className="w-3 h-3" />
          </Button>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => handleInputChange(e.target.value)}
            className="w-14 h-8 text-center text-sm font-mono bg-transparent border-input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            min={1}
            max={product.stock}
          />
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleQuantityChange(1)}
            disabled={quantity >= product.stock}
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      )}

      <div className="flex gap-2 mt-auto">
        <button
          onClick={() => handleAdd('retail')}
          disabled={isOutOfStock}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-pos-retail/10 hover:bg-pos-retail/20 text-pos-retail text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
          Eceran
        </button>
        <button
          onClick={() => handleAdd('bulk')}
          disabled={isOutOfStock}
          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg bg-pos-bulk/10 hover:bg-pos-bulk/20 text-pos-bulk text-xs font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Plus className="w-3 h-3" />
          Grosir
        </button>
      </div>
    </div>
  );
}
