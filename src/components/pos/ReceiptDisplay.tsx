import { useRef } from 'react';
import { ReceiptData, ReceiptDeliveryMethod } from '@/types/pos';
import { Receipt } from './Receipt';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Check, MessageCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

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

export function ReceiptDisplay({ open, onClose, receipt, deliveryMethod }: ReceiptDisplayProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  if (!receipt) return null;

  const generateReceiptText = () => {
    const lines = [
      '================================',
      '         TOKO 88',
      '    Jl. Raya No. 88, Jakarta',
      '      Tel: (021) 1234-5678',
      '================================',
      '',
      `No: ${receipt.id}`,
      `Tanggal: ${receipt.timestamp.toLocaleDateString('id-ID')}`,
      `Waktu: ${receipt.timestamp.toLocaleTimeString('id-ID')}`,
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
      `Pembayaran: ${receipt.paymentMethod}`,
      ...(receipt.cashReceived ? [
        `Tunai: ${formatRupiah(receipt.cashReceived)}`,
        `Kembalian: ${formatRupiah(receipt.change || 0)}`
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
  const qrData = `${window.location.origin}/invoice/${receipt.id}`;

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
              <div ref={receiptRef}>
                <Receipt data={receipt} />
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
              <Button onClick={handleDownload} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download Langsung
              </Button>
            </div>
          )}

          {deliveryMethod === 'whatsapp' && (
            <div className="animate-slide-up space-y-4">
              <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                <p className="text-sm text-muted-foreground">Struk akan dikirim ke:</p>
                <p className="font-mono text-lg font-semibold text-green-400">
                  {receipt.customerPhone}
                </p>
              </div>
              
              <Receipt data={receipt} />

              <Button 
                onClick={handleWhatsAppSend} 
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Kirim via WhatsApp
              </Button>
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
