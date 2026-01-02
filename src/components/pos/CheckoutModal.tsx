import { useState, useEffect } from 'react';
import { CartItem, ReceiptData, ReceiptDeliveryMethod, BankInfo, StoreInfo } from '@/types/pos';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Banknote, Wallet, ArrowLeft, Building2, Loader2, Bluetooth } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { isBluetoothSupported } from '@/utils/escpos';

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

type PaymentMethod = 'Tunai' | 'QRIS' | 'Transfer';

export function CheckoutModal({ open, onClose, items, onComplete }: CheckoutModalProps) {
  const [step, setStep] = useState<'payment' | 'cash' | 'payment-details' | 'receipt'>('payment');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [cashReceived, setCashReceived] = useState('');
  const [receiptMethod, setReceiptMethod] = useState<ReceiptDeliveryMethod | null>(null);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [printWorkerCopy, setPrintWorkerCopy] = useState(true);

  const [discountPercent, setDiscountPercent] = useState('');

  // Settings from database
  const [bankInfo, setBankInfo] = useState<BankInfo | null>(null);
  const [storeInfo, setStoreInfo] = useState<StoreInfo | null>(null);
  const [qrisImageUrl, setQrisImageUrl] = useState<string | null>(null);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);

  // Fetch settings when modal opens
  useEffect(() => {
    if (open) {
      fetchSettings();
    }
  }, [open]);

  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value');
      
      if (error) throw error;

      const settings = data?.reduce((acc, item) => {
        acc[item.key] = item.value || '';
        return acc;
      }, {} as Record<string, string>) || {};

      setBankInfo({
        bankName: settings['bank_name'] || '',
        accountNumber: settings['bank_account_number'] || '',
        accountHolder: settings['bank_account_holder'] || '',
      });

      setStoreInfo({
        address: settings['store_address'] || '',
        phone: settings['store_phone'] || '',
      });

      setQrisImageUrl(settings['qris_image_url'] || null);
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  // Subtotal now includes item-level discounts in Rupiah
  const subtotal = items.reduce((sum, item) => {
    const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
    const itemDiscount = item.discount || 0;
    const discountedTotal = (price * item.quantity) - itemDiscount;
    return sum + Math.max(0, discountedTotal);
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
    } else if (method === 'QRIS' || method === 'Transfer') {
      setStep('payment-details');
    } else {
      setStep('receipt');
    }
  };

  const handleCashConfirm = () => {
    if (cashValue >= total) {
      setStep('receipt');
    }
  };

  const handlePaymentDetailsConfirm = () => {
    setStep('receipt');
  };

  const handleComplete = () => {
    if (!receiptMethod || !paymentMethod) return;

    // Map UI payment method to API payment method
    const paymentMethodMap: Record<PaymentMethod, string> = {
      'Tunai': 'cash',
      'QRIS': 'qris',
      'Transfer': 'transfer',
    };

    const receipt: ReceiptData = {
      id: generateReceiptId(),
      items,
      subtotal,
      discount: discountAmount,
      total,
      paymentMethod: paymentMethodMap[paymentMethod],
      cashReceived: paymentMethod === 'Tunai' ? cashValue : undefined,
      change: paymentMethod === 'Tunai' ? change : undefined,
      timestamp: new Date(),
      customerPhone: receiptMethod === 'whatsapp' ? whatsappNumber : undefined,
      customerName: customerName.trim() || undefined,
      bankInfo: paymentMethod === 'Transfer' && bankInfo ? bankInfo : undefined,
      storeInfo: storeInfo || undefined,
      printWorkerCopy: receiptMethod === 'bluetooth' ? printWorkerCopy : undefined,
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
    } else if (step === 'payment-details') {
      setStep('payment');
      setPaymentMethod(null);
    } else if (step === 'receipt') {
      if (paymentMethod === 'Tunai') {
        setStep('cash');
      } else if (paymentMethod === 'QRIS' || paymentMethod === 'Transfer') {
        setStep('payment-details');
      } else {
        setStep('payment');
        setPaymentMethod(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-md md:max-w-lg max-h-[85vh] landscape:max-h-[75vh] overflow-hidden flex flex-col bg-card border-border">
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
              {step === 'payment-details' && (paymentMethod === 'QRIS' ? 'Pembayaran QRIS' : 'Pembayaran Transfer')}
              {step === 'receipt' && 'Kirim Struk'}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 -mr-1 scroll-smooth" style={{ WebkitOverflowScrolling: 'touch' }}>

        {/* Customer Name & Total Display */}
        <div className="bg-secondary/50 rounded-xl p-4 mb-4">
          <div className="mb-3">
            <label className="text-sm text-muted-foreground mb-1 block">Nama Pelanggan (Opsional)</label>
            <Input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onFocus={(e) => {
                setTimeout(() => {
                  e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              }}
              enterKeyHint="done"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
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
              onClick={() => handlePaymentSelect('Transfer')}
              className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 hover:bg-secondary transition-colors text-left"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="font-semibold">Transfer</p>
                <p className="text-sm text-muted-foreground">Transfer Bank</p>
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
                inputMode="numeric"
                enterKeyHint="done"
                value={cashReceived ? formatRupiah(parseInt(cashReceived.replace(/\D/g, '')) || 0) : ''}
                onChange={(e) => setCashReceived(e.target.value.replace(/\D/g, ''))}
                onFocus={(e) => {
                  setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 300);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
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

        {/* QRIS / Transfer Payment Details */}
        {step === 'payment-details' && (
          <div className="space-y-4">
            {isLoadingSettings ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {paymentMethod === 'QRIS' && (
                  <div className="text-center space-y-4">
                    <p className="text-sm text-muted-foreground">Scan QRIS berikut untuk pembayaran:</p>
                    {qrisImageUrl ? (
                      <div className="w-64 h-64 mx-auto border border-border rounded-lg overflow-hidden bg-white flex items-center justify-center">
                        <img 
                          src={qrisImageUrl} 
                          alt="QRIS" 
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-64 h-64 mx-auto border border-dashed border-border rounded-lg flex items-center justify-center bg-secondary/50">
                        <p className="text-sm text-muted-foreground text-center px-4">
                          Gambar QRIS belum diatur.<br />
                          Silakan upload di halaman Admin.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {paymentMethod === 'Transfer' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">Transfer ke rekening berikut:</p>
                    {bankInfo && (bankInfo.bankName || bankInfo.accountNumber) ? (
                      <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Bank</p>
                          <p className="font-semibold text-lg">{bankInfo.bankName || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Nomor Rekening</p>
                          <p className="font-mono text-xl font-bold">{bankInfo.accountNumber || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Atas Nama</p>
                          <p className="font-semibold">{bankInfo.accountHolder || '-'}</p>
                        </div>
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs text-muted-foreground">Jumlah Transfer</p>
                          <p className="font-mono text-2xl font-bold text-primary">{formatRupiah(total)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-secondary/50 rounded-xl p-4 text-center">
                        <p className="text-sm text-muted-foreground">
                          Informasi bank belum diatur.<br />
                          Silakan atur di halaman Admin.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handlePaymentDetailsConfirm}
                  className="w-full h-12"
                  size="lg"
                >
                  Sudah Dibayar
                </Button>
              </>
            )}
          </div>
        )}

        {/* Receipt Delivery */}
        {step === 'receipt' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Pilih cara pengiriman struk:</p>

            <div className="grid gap-3">
              {/* Bluetooth Print Option - Only show if supported */}
              {isBluetoothSupported() && (
                <div className="space-y-3">
                  <button
                    onClick={() => setReceiptMethod('bluetooth')}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left w-full ${
                      receiptMethod === 'bluetooth'
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Bluetooth className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-semibold">Print Bluetooth</p>
                      <p className="text-sm text-muted-foreground">Cetak ke thermal printer</p>
                    </div>
                  </button>
                  
                  {/* Carbon Copy Toggle - Only show when bluetooth is selected */}
                  {receiptMethod === 'bluetooth' && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 animate-fade-in ml-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                          <span className="text-lg">📋</span>
                        </div>
                        <div>
                          <p className="font-medium text-sm">Carbon Copy (Salinan)</p>
                          <p className="text-xs text-muted-foreground">Print salinan untuk pekerja</p>
                        </div>
                      </div>
                      <Switch
                        checked={printWorkerCopy}
                        onCheckedChange={setPrintWorkerCopy}
                      />
                    </div>
                  )}
                </div>
              )}

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
                  inputMode="tel"
                  enterKeyHint="done"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  onFocus={(e) => {
                    setTimeout(() => {
                      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 300);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
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
