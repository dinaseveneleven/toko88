import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingCartButtonProps {
  itemCount: number;
  total: number;
  onClick: () => void;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

export function FloatingCartButton({ itemCount, total, onClick }: FloatingCartButtonProps) {
  if (itemCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "lg:hidden fixed bottom-4 left-4 right-4 z-50",
        "flex items-center justify-between gap-3",
        "bg-primary text-primary-foreground",
        "px-4 py-3 rounded-2xl shadow-lg",
        "active:scale-[0.98] transition-all",
        "pos-glow-strong"
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <ShoppingCart className="w-6 h-6" />
          <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        </div>
        <span className="font-semibold">Lihat Keranjang</span>
      </div>
      <span className="font-mono font-bold text-lg">
        {formatRupiah(total)}
      </span>
    </button>
  );
}
