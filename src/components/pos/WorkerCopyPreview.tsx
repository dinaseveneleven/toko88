import { ReceiptData } from '@/types/pos';

interface WorkerCopyPreviewProps {
  receipt: ReceiptData;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

export function WorkerCopyPreview({ receipt }: WorkerCopyPreviewProps) {
  const orderNumber = receipt.id.split('-').pop() || receipt.id;
  const time = receipt.timestamp.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  return (
    <div className="bg-secondary/80 rounded-xl p-4 font-mono border-2 border-dashed border-orange-500/50">
      {/* Header */}
      <div className="text-center mb-4 pb-3 border-b-2 border-dashed border-border">
        <p className="text-xs text-orange-500 font-bold uppercase tracking-wider mb-1">
          Salinan Pekerja
        </p>
        <p className="text-3xl font-black">#{orderNumber}</p>
        <p className="text-lg font-bold text-muted-foreground">{time}</p>
        {receipt.customerName && (
          <p className="text-xl font-bold mt-2 text-primary">{receipt.customerName}</p>
        )}
      </div>

      {/* Items - Large text for easy reading */}
      <div className="space-y-3">
        {receipt.items.map((item, index) => {
          const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
          const itemDiscount = item.discount || 0;
          const itemTotal = (price * item.quantity) - itemDiscount;
          
          return (
            <div 
              key={`${item.product.id}-${item.priceType}-${index}`}
              className="bg-background/50 rounded-lg p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-xl font-bold leading-tight">{item.product.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.priceType === 'retail' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {item.priceType === 'retail' ? 'Eceran' : 'Grosir'}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black">{item.quantity}x</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-border/50 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  {formatRupiah(price)} × {item.quantity}
                </span>
                <span className="text-lg font-bold">{formatRupiah(itemTotal)}</span>
              </div>
              {itemDiscount > 0 && (
                <p className="text-sm text-orange-400 mt-1">
                  Disc: -{formatRupiah(itemDiscount)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 pt-3 border-t-2 border-dashed border-border">
        {receipt.discount > 0 && (
          <div className="flex justify-between text-muted-foreground mb-1">
            <span>Diskon</span>
            <span>-{formatRupiah(receipt.discount)}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold">TOTAL</span>
          <span className="text-2xl font-black text-primary">{formatRupiah(receipt.total)}</span>
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-4 pt-3 border-t border-dashed border-border text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">
          Copy ini untuk persiapan pesanan
        </p>
      </div>
    </div>
  );
}