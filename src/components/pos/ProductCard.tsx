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
  // Treat as "variant product" only if there is at least one *real* variant (non-empty code or name)
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const hasVariants = variants.some((v) => {
    const code = typeof v?.code === 'string' ? v.code.trim() : '';
    const name = typeof v?.name === 'string' ? v.name.trim() : '';
    return code.length > 0 || name.length > 0;
  });

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
