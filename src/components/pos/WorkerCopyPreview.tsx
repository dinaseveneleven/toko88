import { ReceiptData } from '@/types/pos';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface WorkerCopyPreviewProps {
  receipt: ReceiptData;
}

export function WorkerCopyPreview({ receipt }: WorkerCopyPreviewProps) {
  return (
    <div className="receipt-paper text-gray-900 p-6 rounded-lg max-w-xs mx-auto">
      {/* Header - Worker Copy Badge */}
      <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
        <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1 rounded-full inline-block mb-2">
          NOTA GUDANG
        </div>
        <h1 className="text-2xl font-black tracking-wide">
          {receipt.customerName || 'PELANGGAN'}
        </h1>
      </div>

      {/* Date & Time Info */}
      <div className="text-sm border-b border-dashed border-gray-400 pb-3 mb-3">
        <div className="flex justify-between">
          <span>{format(receipt.timestamp, 'dd MMM yyyy', { locale: id })}</span>
          <span className="font-bold">{format(receipt.timestamp, 'HH:mm')}</span>
        </div>
      </div>

      {/* Items - BIG text, just name and quantity */}
      <div className="space-y-3 border-b border-dashed border-gray-400 pb-4 mb-4">
        {receipt.items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center gap-3">
            <span className="flex-1 text-lg font-bold leading-tight">
              {item.product.name}
            </span>
            <span className="text-3xl font-black min-w-[60px] text-right">
              {item.quantity}x
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600">
        <div className="bg-gray-200 rounded py-2 px-3">
          <p className="font-bold text-gray-800">COPY UNTUK PERSIAPAN</p>
        </div>
      </div>
    </div>
  );
}