import { useRef, useEffect, useState } from 'react';
import { ReceiptData, ReceiptDeliveryMethod } from '@/types/pos';
import { Receipt } from './Receipt';
import { WorkerCopyPreview } from './WorkerCopyPreview';
import { ThermalReceiptPreview } from './ThermalReceiptPreview';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Check, MessageCircle, AlertTriangle, Bluetooth, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';

interface ReceiptDisplayProps {
  open: boolean;
  onClose: () => void;
  receipt: ReceiptData | null;
  deliveryMethod: ReceiptDeliveryMethod;
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

export function ReceiptDisplay({ open, onClose, receipt, deliveryMethod }: ReceiptDisplayProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [publicBaseUrl, setPublicBaseUrl] = useState<string | null>(null);
  const [storeInfo, setStoreInfo] = useState<{ address: string; phone: string } | null>(null);
  const [invoicePrinted, setInvoicePrinted] = useState(false);
  const [carbonCopyPrinted, setCarbonCopyPrinted] = useState(false);
  const [showWorkerCopy, setShowWorkerCopy] = useState(false);
  const [showThermalPreview, setShowThermalPreview] = useState(false);
  
  const { printReceipt, printInvoiceOnly, printCarbonCopyOnly, isPrinting, isConnected, connectPrinter, isConnecting } = useBluetoothPrinter();

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value');
      
      const settings = data?.reduce((acc, item) => {
        acc[item.key] = item.value || '';
        return acc;
      }, {} as Record<string, string>) || {};
      
      setPublicBaseUrl(settings['public_invoice_base_url'] || null);
      setStoreInfo({
        address: settings['store_address'] || 'Jl. Raya No. 88, Jakarta',
        phone: settings['store_phone'] || '(021) 1234-5678',
      });
    };
    
    if (open) {
      fetchSettings();
      setInvoicePrinted(false);
      setCarbonCopyPrinted(false);
      setShowWorkerCopy(false);
      setShowThermalPreview(false);
    }
  }, [open]);

  if (!receipt) return null;

  // Use public URL if set, otherwise fallback to current origin
  const isPreviewUrl = window.location.origin.includes('lovable.dev');
  const baseUrl = publicBaseUrl || window.location.origin;
  const showWarning = !publicBaseUrl && isPreviewUrl;

  const storeAddress = storeInfo?.address || receipt.storeInfo?.address || 'Jl. Raya No. 88, Jakarta';
  const storePhone = storeInfo?.phone || receipt.storeInfo?.phone || '(021) 1234-5678';
  const paymentLabel = paymentMethodLabels[receipt.paymentMethod] || receipt.paymentMethod;

  const generateReceiptText = () => {
    const lines = [
      '================================',
      '         TOKO BESI 88',
      `    ${storeAddress}`,
      `      Tel: ${storePhone}`,
      '================================',
      '',
      `No: ${receipt.id}`,
      `Tanggal: ${receipt.timestamp.toLocaleDateString('id-ID')}`,
      `Waktu: ${receipt.timestamp.toLocaleTimeString('id-ID')}`,
      ...(receipt.customerName ? [`Pelanggan: ${receipt.customerName}`] : []),
      '',
      '--------------------------------',
      ...receipt.items.map(item => {
        const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
        return `${item.product.name}\n  ${item.quantity} x ${formatRupiah(price)} = ${formatRupiah(price * item.quantity)}`;
      }),
      '--------------------------------',
      `Subtotal: ${formatRupiah(receipt.subtotal)}`,
      ...(receipt.discount > 0 ? [`Diskon: -${formatRupiah(receipt.discount)}`] : []),
      `TOTAL: ${formatRupiah(receipt.total)}`,
      '',
      `Pembayaran: ${paymentLabel}`,
      ...(receipt.cashReceived ? [
        `Tunai: ${formatRupiah(receipt.cashReceived)}`,
        `Kembalian: ${formatRupiah(receipt.change || 0)}`
      ] : []),
      ...(receipt.paymentMethod === 'transfer' && receipt.bankInfo ? [
        '',
        'Transfer ke:',
        `Bank: ${receipt.bankInfo.bankName}`,
        `No. Rek: ${receipt.bankInfo.accountNumber}`,
        `A/N: ${receipt.bankInfo.accountHolder}`,
      ] : []),
      '',
      '================================',
      '      Terima Kasih!',
      '================================',
    ];
    return lines.join('\n');
  };

  const handleDownload = () => {
    const text = generateReceiptText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `struk-${receipt.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppSend = () => {
    if (!receipt.customerPhone) return;
    
    const text = generateReceiptText();
    const encodedText = encodeURIComponent(text);
    const phone = receipt.customerPhone.replace(/\D/g, '');
    const formattedPhone = phone.startsWith('0') ? '62' + phone.slice(1) : phone;
    
    window.open(`https://wa.me/${formattedPhone}?text=${encodedText}`, '_blank');
  };

  // Generate QR URL that links to the invoice page
  const qrData = `${baseUrl}/invoice/${receipt.id}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Check className="w-5 h-5 text-primary" />
            Transaksi Berhasil!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {deliveryMethod === 'display' && (
            <div className="animate-slide-up">
              {/* Toggle between customer receipt and worker copy */}
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setShowWorkerCopy(false)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    !showWorkerCopy 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Struk Pelanggan
                </button>
                <button
                  onClick={() => setShowWorkerCopy(true)}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                    showWorkerCopy 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  📋 Carbon Copy
                </button>
              </div>

              {/* Toggle between pretty preview and thermal preview */}
              <div className="flex justify-center mb-4">
                <button
                  onClick={() => setShowThermalPreview(!showThermalPreview)}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  {showThermalPreview ? 'Tampilan Normal' : 'Tampilan Printer (Thermal)'}
                </button>
              </div>

              <div ref={receiptRef}>
                {showThermalPreview ? (
                  <ThermalReceiptPreview 
                    receipt={receipt} 
                    storeInfo={storeInfo || undefined}
                    type={showWorkerCopy ? 'worker' : 'invoice'}
                  />
                ) : showWorkerCopy ? (
                  <WorkerCopyPreview receipt={receipt} />
                ) : (
                  <Receipt data={{ ...receipt, storeInfo: storeInfo || receipt.storeInfo }} />
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleDownload} variant="outline" className="flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button onClick={handlePrint} variant="outline" className="flex-1">
                  <Printer className="w-4 h-4 mr-2" />
                  Print
                </Button>
              </div>
            </div>
          )}

          {deliveryMethod === 'barcode' && (
            <div className="animate-scale-in text-center space-y-4">
              <p className="text-muted-foreground">Scan QR code untuk download struk</p>
              <div className="barcode-container inline-block">
                <QRCodeSVG 
                  value={qrData}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
              <p className="text-xs text-muted-foreground font-mono">{receipt.id}</p>
              
              {showWarning && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2 text-left">
                  <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-yellow-500">
                    QR menggunakan URL preview. Atur URL Struk Publik di Admin agar pelanggan bisa akses tanpa login.
                  </p>
                </div>
              )}
              
              <Button onClick={handleDownload} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download Langsung
              </Button>
            </div>
          )}

          {deliveryMethod === 'whatsapp' && (
            <div className="animate-slide-up space-y-4">
              <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                <p className="text-sm text-muted-foreground">Struk otomatis dikirim ke:</p>
                <p className="font-mono text-lg font-semibold text-green-400">
                  {receipt.customerPhone}
                </p>
                <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  WhatsApp terkirim otomatis
                </p>
              </div>
              
              <Receipt data={{ ...receipt, storeInfo: storeInfo || receipt.storeInfo }} />

              <Button 
                onClick={handleWhatsAppSend} 
                variant="outline"
                className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Kirim Ulang via WhatsApp
              </Button>
            </div>
          )}

          {deliveryMethod === 'bluetooth' && (
            <div className="animate-slide-up space-y-4">
              {isPrinting ? (
                <div className="text-center py-8">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                  <p className="text-muted-foreground">Mencetak struk...</p>
                </div>
              ) : (invoicePrinted || carbonCopyPrinted) ? (
                <div className="bg-primary/10 rounded-xl p-4 border border-primary/20 text-center">
                  <Bluetooth className="w-8 h-8 text-primary mx-auto mb-2" />
                  <p className="font-semibold">
                    {invoicePrinted && carbonCopyPrinted 
                      ? 'Semua Struk Dicetak!' 
                      : invoicePrinted 
                        ? 'Invoice Dicetak!' 
                        : 'Carbon Copy Dicetak!'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {invoicePrinted && !carbonCopyPrinted && 'Cetak carbon copy jika diperlukan'}
                    {!invoicePrinted && carbonCopyPrinted && 'Cetak invoice jika diperlukan'}
                    {invoicePrinted && carbonCopyPrinted && 'Kedua struk telah dicetak'}
                  </p>
                </div>
              ) : (
                <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20 text-center">
                  <Bluetooth className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <p className="font-semibold">Print via Bluetooth</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isConnected ? 'Printer terhubung - pilih struk untuk dicetak' : 'Hubungkan printer terlebih dahulu'}
                  </p>
                </div>
              )}
              
              <Receipt data={{ ...receipt, storeInfo: storeInfo || receipt.storeInfo }} />

              <div className="space-y-2">
                {!isConnected ? (
                  <Button 
                    onClick={connectPrinter}
                    disabled={isConnecting}
                    className="w-full"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Menghubungkan...
                      </>
                    ) : (
                      <>
                        <Bluetooth className="w-4 h-4 mr-2" />
                        Hubungkan Printer
                      </>
                    )}
                  </Button>
                ) : (
                  <>
                    {/* Two separate print buttons */}
                    <div className="flex gap-2">
                      <Button 
                        onClick={async () => {
                          const success = await printInvoiceOnly(receipt, storeInfo || undefined);
                          if (success) {
                            setInvoicePrinted(true);
                          }
                        }}
                        disabled={isPrinting}
                        className="flex-1"
                        variant={invoicePrinted ? "outline" : "default"}
                      >
                        {isPrinting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : invoicePrinted ? (
                          <Check className="w-4 h-4 mr-2" />
                        ) : (
                          <Printer className="w-4 h-4 mr-2" />
                        )}
                        {invoicePrinted ? 'Invoice ✓' : 'Cetak Invoice'}
                      </Button>
                      
                      <Button 
                        onClick={async () => {
                          const success = await printCarbonCopyOnly(receipt);
                          if (success) {
                            setCarbonCopyPrinted(true);
                          }
                        }}
                        disabled={isPrinting}
                        className="flex-1"
                        variant={carbonCopyPrinted ? "outline" : "secondary"}
                      >
                        {isPrinting ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : carbonCopyPrinted ? (
                          <Check className="w-4 h-4 mr-2" />
                        ) : (
                          <span className="mr-2">📋</span>
                        )}
                        {carbonCopyPrinted ? 'Copy ✓' : 'Carbon Copy'}
                      </Button>
                    </div>
                  </>
                )}
                <Button onClick={handleDownload} variant="outline" className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          )}

          <Button onClick={onClose} variant="outline" className="w-full">
            Transaksi Baru
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
