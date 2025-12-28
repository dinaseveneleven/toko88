import { useState } from 'react';
import { CartItem, ReceiptData, ReceiptDeliveryMethod } from '@/types/pos';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CreditCard, Banknote, Wallet, ArrowLeft } from 'lucide-react';

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  onComplete: (receipt: ReceiptData, deliveryMethod: ReceiptDeliveryMethod, phone?: string) => void;
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

const generateReceiptId = () => {
  const date = new Date();
  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const timeStr = `${String(date.getHours()).padStart(2, '0')}${String(date.getMinutes()).padStart(2, '0')}`;
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${dateStr}-${timeStr}-${random}`;
};

type PaymentMethod = 'Tunai' | 'QRIS' | 'Debit/Kredit';

export function CheckoutModal({ open, onClose, items, onComplete }: CheckoutModalProps) {
  const [step, setStep] = useState<'payment' | 'cash' | 'receipt'>('payment');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [receiptMethod, setReceiptMethod] = useState<ReceiptDeliveryMethod | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [customerName, setCustomerName] = useState('');

  const [discountPercent, setDiscountPercent] = useState('');

  const subtotal = items.reduce((sum, item) => {
    const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
    return sum + price * item.quantity;
  }, 0);
  
  const discountValue = parseInt(discountPercent) || 0;
  const discountAmount = Math.round(subtotal * (discountValue / 100));
  const total = subtotal - discountAmount;

  const cashValue = parseInt(cashReceived.replace(/\D/g, '')) || 0;
  const change = cashValue - total;

  const quickCashAmounts = [
    Math.ceil(total / 10000) * 10000,
    Math.ceil(total / 50000) * 50000,
    Math.ceil(total / 100000) * 100000,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= total);

  const handlePaymentSelect = (method: PaymentMethod) => {
    setPaymentMethod(method);
    if (method === 'Tunai') {
      setStep('cash');
    } else {
      setStep('receipt');
    }
  };

  const handleCashConfirm = () => {
    if (cashValue >= total) {
      setStep('receipt');
    }
  };

  const handleComplete = () => {
    if (!receiptMethod || !paymentMethod) return;

    const receipt: ReceiptData = {
      id: generateReceiptId(),
      items,
      subtotal,
      discount: discountAmount,
      total,
      paymentMethod,
      cashReceived: paymentMethod === 'Tunai' ? cashValue : undefined,
      change: paymentMethod === 'Tunai' ? change : undefined,
      timestamp: new Date(),
      customerPhone: receiptMethod === 'whatsapp' ? whatsappNumber : undefined,
      customerName: customerName.trim() || undefined,
    };

    onComplete(receipt, receiptMethod, receiptMethod === 'whatsapp' ? whatsappNumber : undefined);
    resetAndClose();
  };

  const resetAndClose = () => {
    setStep('payment');
    setPaymentMethod(null);
    setCashReceived('');
    setDiscountPercent('');
    setReceiptMethod(null);
    setWhatsappNumber('');
    setCustomerName('');
    onClose();
  };

  const goBack = () => {
    if (step === 'cash') {
      setStep('payment');
      setPaymentMethod(null);
    } else if (step === 'receipt') {
      if (paymentMethod === 'Tunai') {
        setStep('cash');
      } else {
        setStep('payment');
        setPaymentMethod(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-md md:max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-card border-border">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            {step !== 'payment' && (
              <button onClick={goBack} className="p-1 hover:bg-secondary rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <DialogTitle>
              {step === 'payment' && 'Pilih Pembayaran'}
              {step === 'cash' && 'Pembayaran Tunai'}
              {step === 'receipt' && 'Kirim Struk'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">

        {/* Customer Name & Total Display */}
        <div className="bg-secondary/50 rounded-xl p-4 mb-4">
          <div className="mb-3">
            <label className="text-sm text-muted-foreground mb-1 block">Nama Pelanggan (Opsional)</label>
            <Input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Masukkan nama pelanggan..."
              className="h-10"
            />
          </div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">Subtotal</p>
            <p className="font-mono text-lg">{formatRupiah(subtotal)}</p>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm text-muted-foreground">Diskon (%)</p>
            <input
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="0"
              className="w-16 h-8 px-2 rounded-lg bg-background border border-border text-center font-mono text-sm"
            />
            {discountAmount > 0 && (
              <span className="text-sm text-pos-retail">-{formatRupiah(discountAmount)}</span>
            )}
          </div>
          <div className="border-t border-border pt-2">
            <p className="text-sm text-muted-foreground">Total Pembayaran</p>
            <p className="font-mono text-3xl font-bold text-primary">{formatRupiah(total)}</p>
          </div>
        </div>

        {/* Payment Selection */}
        {step === 'payment' && (
          <div className="grid gap-3">
            <button
              onClick={() => handlePaymentSelect('Tunai')}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-pos-retail/20 flex items-center justify-center">
                <Banknote className="w-6 h-6 text-pos-retail" />
              </div>
              <div>
                <p className="font-semibold">Tunai</p>
                <p className="text-sm text-muted-foreground">Bayar dengan uang cash</p>
              </div>
            </button>
            <button
              onClick={() => handlePaymentSelect('QRIS')}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-pos-bulk/20 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-pos-bulk" />
              </div>
              <div>
                <p className="font-semibold">QRIS</p>
                <p className="text-sm text-muted-foreground">GoPay, OVO, Dana, dll</p>
              </div>
            </button>
            <button
              onClick={() => handlePaymentSelect('Debit/Kredit')}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="font-semibold">Debit/Kredit</p>
                <p className="text-sm text-muted-foreground">Kartu Debit atau Kredit</p>
              </div>
            </button>
          </div>
        )}

        {/* Cash Payment */}
        {step === 'cash' && (
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Jumlah Uang Diterima</label>
              <Input
                type="text"
                value={cashReceived ? formatRupiah(parseInt(cashReceived.replace(/\D/g, '')) || 0) : ''}
                onChange={(e) => setCashReceived(e.target.value.replace(/\D/g, ''))}
                placeholder="Masukkan jumlah..."
                className="h-14 text-xl font-mono"
                autoFocus
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              {quickCashAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => setCashReceived(amount.toString())}
                  className="px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-mono transition-colors"
                >
                  {formatRupiah(amount)}
                </button>
              ))}
              <button
                onClick={() => setCashReceived(total.toString())}
                className="px-4 py-2 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary text-sm font-medium transition-colors"
              >
                Pas
              </button>
            </div>

            {cashValue >= total && (
              <div className="bg-pos-retail/10 rounded-xl p-4 border border-pos-retail/20">
                <p className="text-sm text-muted-foreground">Kembalian</p>
                <p className="font-mono text-2xl font-bold text-pos-retail">
                  {formatRupiah(change)}
                </p>
              </div>
            )}

            <Button
              onClick={handleCashConfirm}
              disabled={cashValue < total}
              className="w-full h-12"
              size="lg"
            >
              Lanjutkan
            </Button>
          </div>
        )}

        {/* Receipt Delivery */}
        {step === 'receipt' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pilih cara pengiriman struk:</p>

            <div className="grid gap-3">
              <button
                onClick={() => setReceiptMethod('display')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  receiptMethod === 'display'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">
                  📄
                </div>
                <div>
                  <p className="font-semibold">Tampilkan Struk</p>
                  <p className="text-sm text-muted-foreground">Lihat struk di layar</p>
                </div>
              </button>

              <button
                onClick={() => setReceiptMethod('barcode')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  receiptMethod === 'barcode'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl">
                  📱
                </div>
                <div>
                  <p className="font-semibold">Scan QR Code</p>
                  <p className="text-sm text-muted-foreground">Download via barcode</p>
                </div>
              </button>

              <button
                onClick={() => setReceiptMethod('whatsapp')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                  receiptMethod === 'whatsapp'
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-xl">
                  💬
                </div>
                <div>
                  <p className="font-semibold">Kirim via WhatsApp</p>
                  <p className="text-sm text-muted-foreground">Kirim ke nomor pelanggan</p>
                </div>
              </button>
            </div>

            {receiptMethod === 'whatsapp' && (
              <div className="animate-fade-in">
                <label className="text-sm text-muted-foreground mb-2 block">Nomor WhatsApp</label>
                <Input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="08xx xxxx xxxx"
                  className="h-12"
                />
              </div>
            )}

            <Button
              onClick={handleComplete}
              disabled={!receiptMethod || (receiptMethod === 'whatsapp' && !whatsappNumber)}
              className="w-full h-12 pos-glow"
              size="lg"
            >
              Selesaikan Transaksi
            </Button>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
