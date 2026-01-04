import { Product } from '@/types/pos';
import { SimpleProductCard } from './SimpleProductCard';
import { VariantProductCard } from './VariantProductCard';

interface ProductCardProps {
  product: Product;
  pricingMode: 'retail' | 'grosir';
  onAdd: (product: Product, quantity: number, variantCode?: string, variantName?: string) => void;
  searchQuery?: string;
}

export const ProductCard = ({ product, pricingMode, onAdd, searchQuery }: ProductCardProps) => {
  // Strict check: only true if variants array exists AND has at least one item
  const hasVariants = Array.isArray(product.variants) && product.variants.length > 0;

  if (hasVariants) {
    return (
      <VariantProductCard
        product={product}
        pricingMode={pricingMode}
        onAdd={onAdd}
        searchQuery={searchQuery}
      />
    );
  }

  return (
    <SimpleProductCard
      product={product}
      pricingMode={pricingMode}
      onAdd={onAdd}
    />
  );
};
