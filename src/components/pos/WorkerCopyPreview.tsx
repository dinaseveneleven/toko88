import { ReceiptData } from '@/types/pos';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

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
  return (
    <div className="receipt-paper text-gray-900 p-6 rounded-lg max-w-xs mx-auto">
      {/* Header - Worker Copy Badge */}
      <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
        <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-2">
          SALINAN PEKERJA
        </div>
        <h1 className="text-2xl font-black tracking-wide">
          {receipt.customerName || 'PELANGGAN'}
        </h1>
        <p className="text-xs mt-1 text-gray-600">No: {receipt.id}</p>
      </div>

      {/* Date & Time Info */}
      <div className="text-xs border-b border-dashed border-gray-400 pb-3 mb-3">
        <div className="flex justify-between">
          <span>Tanggal:</span>
          <span className="font-semibold">{format(receipt.timestamp, 'dd MMM yyyy', { locale: id })}</span>
        </div>
        <div className="flex justify-between">
          <span>Waktu:</span>
          <span className="font-semibold">{format(receipt.timestamp, 'HH:mm:ss')}</span>
        </div>
      </div>

      {/* Items - Larger text for workers */}
      <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
        <div className="text-xs font-semibold flex justify-between mb-2 text-gray-600">
          <span className="flex-1">Item</span>
          <span className="w-16 text-right">Qty</span>
          <span className="w-20 text-right">Total</span>
        </div>
        {receipt.items.map((item, idx) => {
          const price = item.priceType === 'retail' 
            ? item.product.retailPrice 
            : item.product.bulkPrice;
          const itemDiscount = item.discount || 0;
          const total = (price * item.quantity) - itemDiscount;
          
          return (
            <div key={idx} className="text-sm mb-2">
              <div className="flex justify-between items-start">
                <span className="flex-1 font-bold pr-2">
                  {item.product.name}
                  <span className="text-gray-500 ml-1 text-xs font-normal">
                    ({item.priceType === 'retail' ? 'E' : 'G'})
                  </span>
                </span>
                <span className="w-16 text-right font-bold text-base">{item.quantity}x</span>
                <span className="w-20 text-right text-xs">{formatRupiah(total)}</span>
              </div>
              <div className="text-gray-500 text-xs">
                @ {formatRupiah(price)}
              </div>
              {itemDiscount > 0 && (
                <div className="text-orange-600 text-xs">
                  Disc: -{formatRupiah(itemDiscount)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="text-xs space-y-1 border-b border-dashed border-gray-400 pb-3 mb-3">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatRupiah(receipt.subtotal)}</span>
        </div>
        {receipt.discount > 0 && (
          <div className="flex justify-between text-orange-600">
            <span>Diskon:</span>
            <span>-{formatRupiah(receipt.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-gray-300">
          <span>TOTAL:</span>
          <span>{formatRupiah(receipt.total)}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 mt-4">
        <div className="bg-gray-200 rounded py-2 px-3">
          <p className="font-bold text-gray-800">COPY UNTUK PERSIAPAN</p>
          <p className="text-gray-500 mt-1">Bukan struk pelanggan</p>
        </div>
      </div>
    </div>
  );
}