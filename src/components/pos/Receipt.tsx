import { ReceiptData } from '@/types/pos';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface ReceiptProps {
  data: ReceiptData;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

const paymentMethodLabels: Record<string, string> = {
  'cash': 'Tunai',
  'qris': 'QRIS',
  'transfer': 'Transfer Bank',
};

export function Receipt({ data }: ReceiptProps) {
  const storeAddress = data.storeInfo?.address || 'Jl. Raya No. 88, Jakarta';
  const storePhone = data.storeInfo?.phone || '(021) 1234-5678';
  const paymentLabel = paymentMethodLabels[data.paymentMethod] || data.paymentMethod;

  return (
    <div className="receipt-paper text-gray-900 p-6 rounded-lg max-w-xs mx-auto">
      {/* Header */}
      <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
        <h1 className="text-xl font-bold tracking-wide">TOKO BESI 88</h1>
        <p className="text-xs mt-1">{storeAddress}</p>
        <p className="text-xs">Tel: {storePhone}</p>
      </div>

      {/* Transaction Info */}
      <div className="text-xs border-b border-dashed border-gray-400 pb-3 mb-3">
        <div className="flex justify-between">
          <span>No:</span>
          <span className="font-semibold">{data.id}</span>
        </div>
        <div className="flex justify-between">
          <span>Tanggal:</span>
          <span>{format(data.timestamp, 'dd MMM yyyy', { locale: id })}</span>
        </div>
        <div className="flex justify-between">
          <span>Waktu:</span>
          <span>{format(data.timestamp, 'HH:mm:ss')}</span>
        </div>
        {data.customerName && (
          <div className="flex justify-between">
            <span>Pelanggan:</span>
            <span className="font-semibold">{data.customerName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Kasir:</span>
          <span>Admin</span>
        </div>
      </div>

      {/* Items */}
      <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
        <div className="text-xs font-semibold flex justify-between mb-2 text-gray-600">
          <span className="w-12 text-left">Qty</span>
          <span className="flex-1">Item</span>
          <span className="w-20 text-right">Total</span>
        </div>
        {data.items.map((item, idx) => {
          const price = item.priceType === 'retail' 
            ? item.product.retailPrice 
            : item.product.bulkPrice;
          const total = price * item.quantity;
          
          return (
            <div key={idx} className="text-xs mb-2">
              <div className="flex justify-between">
                <span className="w-12 text-left">{item.quantity}x</span>
                <span className="flex-1 truncate pr-2">
                  {item.product.name}
                  <span className="text-gray-500 ml-1">
                    ({item.priceType === 'retail' ? 'E' : 'G'})
                  </span>
                </span>
                <span className="w-20 text-right">{formatRupiah(total)}</span>
              </div>
              <div className="text-gray-500 text-right">
                @ {formatRupiah(price)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals */}
      <div className="text-xs space-y-1 border-b border-dashed border-gray-400 pb-3 mb-3">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{formatRupiah(data.subtotal)}</span>
        </div>
        {data.discount > 0 && (
          <div className="flex justify-between text-green-600">
            <span>Diskon:</span>
            <span>-{formatRupiah(data.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-gray-300">
          <span>TOTAL:</span>
          <span>{formatRupiah(data.total)}</span>
        </div>
      </div>

      {/* Payment */}
      <div className="text-xs space-y-1 border-b border-dashed border-gray-400 pb-3 mb-3">
        <div className="flex justify-between">
          <span>Pembayaran:</span>
          <span>{paymentLabel}</span>
        </div>
        {data.cashReceived && (
          <>
            <div className="flex justify-between">
              <span>Tunai:</span>
              <span>{formatRupiah(data.cashReceived)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Kembalian:</span>
              <span>{formatRupiah(data.change || 0)}</span>
            </div>
          </>
        )}
        {data.paymentMethod === 'transfer' && data.bankInfo && (
          <div className="mt-2 pt-2 border-t border-gray-300">
            <p className="font-semibold mb-1">Transfer ke:</p>
            <div className="flex justify-between">
              <span>Bank:</span>
              <span>{data.bankInfo.bankName}</span>
            </div>
            <div className="flex justify-between">
              <span>No. Rek:</span>
              <span className="font-mono">{data.bankInfo.accountNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>A/N:</span>
              <span>{data.bankInfo.accountHolder}</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-600 mt-4">
        <p className="font-semibold">Terima Kasih!</p>
        <p>Barang yang sudah dibeli</p>
        <p>tidak dapat ditukar/dikembalikan</p>
        <div className="mt-3 pt-3 border-t border-dashed border-gray-400">
          <p>*** SIMPAN STRUK INI ***</p>
        </div>
      </div>
    </div>
  );
}
