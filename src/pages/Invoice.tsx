import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Loader2 } from 'lucide-react';

interface TransactionItem {
  product: {
    name: string;
    retailPrice: number;
    bulkPrice: number;
  };
  quantity: number;
  priceType: 'retail' | 'bulk';
}

interface Transaction {
  id: string;
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  total: number;
  payment_method: string;
  cash_received: number | null;
  change: number | null;
  customer_name: string | null;
  cashier: string | null;
  created_at: string;
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
  'transfer': 'Debit/Kredit',
};

export default function Invoice() {
  const { id: invoiceId } = useParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransaction = async () => {
      if (!invoiceId) {
        setError('ID invoice tidak valid');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (fetchError) {
        console.error('Error fetching transaction:', fetchError);
        setError('Invoice tidak ditemukan');
      } else if (data) {
        // Cast items from Json to TransactionItem[]
        setTransaction({
          ...data,
          items: data.items as unknown as TransactionItem[]
        } as Transaction);
      }
      setLoading(false);
    };

    fetchTransaction();
  }, [invoiceId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Invoice Tidak Ditemukan</h1>
          <p className="text-muted-foreground">{error || 'Terjadi kesalahan'}</p>
        </div>
      </div>
    );
  }

  const items = transaction.items as TransactionItem[];
  const timestamp = new Date(transaction.created_at);

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="receipt-paper text-gray-900 p-6 rounded-lg max-w-xs mx-auto shadow-lg">
        {/* Header */}
        <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
          <h1 className="text-xl font-bold tracking-wide">TOKO 88</h1>
          <p className="text-xs mt-1">Jl. Raya No. 88, Jakarta</p>
          <p className="text-xs">Tel: (021) 1234-5678</p>
        </div>

        {/* Transaction Info */}
        <div className="text-xs border-b border-dashed border-gray-400 pb-3 mb-3">
          <div className="flex justify-between">
            <span>No:</span>
            <span className="font-semibold">{transaction.id}</span>
          </div>
          <div className="flex justify-between">
            <span>Tanggal:</span>
            <span>{format(timestamp, 'dd MMM yyyy', { locale: id })}</span>
          </div>
          <div className="flex justify-between">
            <span>Waktu:</span>
            <span>{format(timestamp, 'HH:mm:ss')}</span>
          </div>
          {transaction.customer_name && (
            <div className="flex justify-between">
              <span>Pelanggan:</span>
              <span className="font-semibold">{transaction.customer_name}</span>
            </div>
          )}
          {transaction.cashier && (
            <div className="flex justify-between">
              <span>Kasir:</span>
              <span>{transaction.cashier}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="border-b border-dashed border-gray-400 pb-3 mb-3">
          <div className="text-xs font-semibold flex justify-between mb-2 text-gray-600">
            <span className="flex-1">Item</span>
            <span className="w-16 text-right">Qty</span>
            <span className="w-20 text-right">Total</span>
          </div>
          {items.map((item, idx) => {
            const price = item.priceType === 'retail' 
              ? item.product.retailPrice 
              : item.product.bulkPrice;
            const total = price * item.quantity;
            
            return (
              <div key={idx} className="text-xs mb-2">
                <div className="flex justify-between">
                  <span className="flex-1 truncate pr-2">
                    {item.product.name}
                    <span className="text-gray-500 ml-1">
                      ({item.priceType === 'retail' ? 'E' : 'G'})
                    </span>
                  </span>
                  <span className="w-16 text-right">{item.quantity}x</span>
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
            <span>{formatRupiah(transaction.subtotal)}</span>
          </div>
          {transaction.discount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Diskon:</span>
              <span>-{formatRupiah(transaction.discount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-sm mt-2 pt-2 border-t border-gray-300">
            <span>TOTAL:</span>
            <span>{formatRupiah(transaction.total)}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="text-xs space-y-1 border-b border-dashed border-gray-400 pb-3 mb-3">
          <div className="flex justify-between">
            <span>Pembayaran:</span>
            <span>{paymentMethodLabels[transaction.payment_method] || transaction.payment_method}</span>
          </div>
          {transaction.cash_received && (
            <>
              <div className="flex justify-between">
                <span>Tunai:</span>
                <span>{formatRupiah(transaction.cash_received)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Kembalian:</span>
                <span>{formatRupiah(transaction.change || 0)}</span>
              </div>
            </>
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
    </div>
  );
}
