import { ReceiptData, CartItem } from '@/types/pos';

// ESC/POS Commands for thermal printers
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// Initialize printer
const INIT = [ESC, 0x40];

// Text alignment
const ALIGN_LEFT = [ESC, 0x61, 0x00];
const ALIGN_CENTER = [ESC, 0x61, 0x01];
const ALIGN_RIGHT = [ESC, 0x61, 0x02];

// Text style
const BOLD_ON = [ESC, 0x45, 0x01];
const BOLD_OFF = [ESC, 0x45, 0x00];
const DOUBLE_HEIGHT = [ESC, 0x21, 0x10];
const DOUBLE_WIDTH = [ESC, 0x21, 0x20];
const DOUBLE_SIZE = [ESC, 0x21, 0x30];
const NORMAL_SIZE = [ESC, 0x21, 0x00];

// Paper control
const FEED_LINE = [LF];
const CUT_PAPER = [GS, 0x56, 0x00]; // Full cut
const PARTIAL_CUT = [GS, 0x56, 0x01]; // Partial cut

// 80mm paper = 48 characters per line (standard font)
const LINE_WIDTH = 48;

// Helper to format Rupiah without symbol for receipt (more compact)
const formatRupiah = (num: number): string => {
  return new Intl.NumberFormat('id-ID').format(num);
};

// Helper to pad/align text
const padRight = (text: string, width: number): string => {
  return text.slice(0, width).padEnd(width, ' ');
};

const padLeft = (text: string, width: number): string => {
  return text.slice(0, width).padStart(width, ' ');
};

const centerText = (text: string, width: number): string => {
  const padding = Math.max(0, width - text.length);
  const leftPad = Math.floor(padding / 2);
  return ' '.repeat(leftPad) + text;
};

// Convert string to byte array (ASCII)
const textToBytes = (text: string): number[] => {
  return Array.from(text).map(char => char.charCodeAt(0));
};

// Create line separator
const createSeparator = (char: string = '-'): number[] => {
  return [...textToBytes(char.repeat(LINE_WIDTH)), LF];
};

// Create double line separator
const createDoubleSeparator = (): number[] => {
  return [...textToBytes('='.repeat(LINE_WIDTH)), LF];
};

// Format a single item line for receipt
const formatItemLine = (item: CartItem): number[][] => {
  const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
  const priceLabel = item.priceType === 'retail' ? '(E)' : '(G)';
  const itemTotal = price * item.quantity;
  const itemDiscount = item.discount || 0;
  const finalTotal = Math.max(0, itemTotal - itemDiscount);
  
  const lines: number[][] = [];
  
  // Product name with price type indicator
  const productName = `${item.product.name} ${priceLabel}`;
  lines.push([...textToBytes(productName.slice(0, LINE_WIDTH)), LF]);
  
  // Quantity x Price = Total (indented)
  const qtyPrice = `  ${item.quantity} x Rp ${formatRupiah(price)}`;
  const totalStr = `Rp ${formatRupiah(finalTotal)}`;
  const spaceBetween = LINE_WIDTH - qtyPrice.length - totalStr.length;
  
  if (spaceBetween > 0) {
    lines.push([...textToBytes(qtyPrice + ' '.repeat(spaceBetween) + totalStr), LF]);
  } else {
    lines.push([...textToBytes(qtyPrice), LF]);
    lines.push([...ALIGN_RIGHT, ...textToBytes(totalStr), LF, ...ALIGN_LEFT]);
  }
  
  // Show item discount if any
  if (itemDiscount > 0) {
    const discountLine = `  Diskon: -Rp ${formatRupiah(itemDiscount)}`;
    lines.push([...textToBytes(discountLine), LF]);
  }
  
  return lines;
};

// Format two-column line (label on left, value on right)
const formatTwoColumn = (left: string, right: string): number[] => {
  const spaceBetween = LINE_WIDTH - left.length - right.length;
  if (spaceBetween > 0) {
    return [...textToBytes(left + ' '.repeat(spaceBetween) + right), LF];
  }
  return [...textToBytes(left.slice(0, LINE_WIDTH - right.length - 1) + ' ' + right), LF];
};

// Build complete receipt as byte array
export const buildReceiptBytes = (receipt: ReceiptData, storeInfo?: { address: string; phone: string }): Uint8Array => {
  const bytes: number[] = [];
  
  // Initialize printer
  bytes.push(...INIT);
  
  // Store header (centered, bold)
  bytes.push(...ALIGN_CENTER);
  bytes.push(...createDoubleSeparator());
  bytes.push(...DOUBLE_SIZE);
  bytes.push(...BOLD_ON);
  bytes.push(...textToBytes('TOKO 88'), LF);
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  
  // Store info
  const address = storeInfo?.address || receipt.storeInfo?.address || 'Jl. Raya No. 88';
  const phone = storeInfo?.phone || receipt.storeInfo?.phone || '(021) 1234-5678';
  bytes.push(...textToBytes(address.slice(0, LINE_WIDTH)), LF);
  bytes.push(...textToBytes(`Tel: ${phone}`), LF);
  bytes.push(...createDoubleSeparator());
  bytes.push(LF);
  
  // Receipt details (left aligned)
  bytes.push(...ALIGN_LEFT);
  bytes.push(...textToBytes(`No: ${receipt.id}`), LF);
  bytes.push(...textToBytes(`Tanggal: ${receipt.timestamp.toLocaleDateString('id-ID')}`), LF);
  bytes.push(...textToBytes(`Waktu: ${receipt.timestamp.toLocaleTimeString('id-ID')}`), LF);
  
  if (receipt.customerName) {
    bytes.push(...textToBytes(`Pelanggan: ${receipt.customerName.slice(0, 30)}`), LF);
  }
  
  bytes.push(...createSeparator());
  
  // Items
  for (const item of receipt.items) {
    const itemLines = formatItemLine(item);
    for (const line of itemLines) {
      bytes.push(...line);
    }
  }
  
  bytes.push(...createSeparator());
  
  // Totals
  bytes.push(...formatTwoColumn('Subtotal:', `Rp ${formatRupiah(receipt.subtotal)}`));
  
  if (receipt.discount > 0) {
    bytes.push(...formatTwoColumn('Diskon:', `-Rp ${formatRupiah(receipt.discount)}`));
  }
  
  bytes.push(...createSeparator());
  bytes.push(...BOLD_ON);
  bytes.push(...formatTwoColumn('TOTAL:', `Rp ${formatRupiah(receipt.total)}`));
  bytes.push(...BOLD_OFF);
  bytes.push(...createDoubleSeparator());
  
  // Payment info
  const paymentLabels: Record<string, string> = {
    'cash': 'Tunai',
    'qris': 'QRIS',
    'transfer': 'Transfer',
  };
  bytes.push(...formatTwoColumn('Pembayaran:', paymentLabels[receipt.paymentMethod] || receipt.paymentMethod));
  
  if (receipt.cashReceived) {
    bytes.push(...formatTwoColumn('Tunai:', `Rp ${formatRupiah(receipt.cashReceived)}`));
    bytes.push(...formatTwoColumn('Kembalian:', `Rp ${formatRupiah(receipt.change || 0)}`));
  }
  
  // Bank transfer info
  if (receipt.paymentMethod === 'transfer' && receipt.bankInfo) {
    bytes.push(LF);
    bytes.push(...textToBytes('Transfer ke:'), LF);
    bytes.push(...textToBytes(`Bank: ${receipt.bankInfo.bankName}`), LF);
    bytes.push(...textToBytes(`No.Rek: ${receipt.bankInfo.accountNumber}`), LF);
    bytes.push(...textToBytes(`A/N: ${receipt.bankInfo.accountHolder}`), LF);
  }
  
  bytes.push(...createDoubleSeparator());
  
  // Footer (centered)
  bytes.push(...ALIGN_CENTER);
  bytes.push(...textToBytes('Terima Kasih!'), LF);
  bytes.push(...textToBytes('Barang yang sudah dibeli'), LF);
  bytes.push(...textToBytes('tidak dapat ditukar/dikembalikan'), LF);
  bytes.push(...createDoubleSeparator());
  bytes.push(...textToBytes('*** SIMPAN STRUK INI ***'), LF);
  bytes.push(LF, LF, LF); // Feed some paper
  
  // Cut paper
  bytes.push(...CUT_PAPER);
  
  return new Uint8Array(bytes);
};

// Check if Web Bluetooth is supported
export const isBluetoothSupported = (): boolean => {
  return 'bluetooth' in navigator;
};

// Common Bluetooth Serial Port Profile UUIDs for thermal printers
export const PRINTER_SERVICE_UUIDS = [
  '0000ff00-0000-1000-8000-00805f9b34fb', // Common thermal printer service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Nordic UART
  '000018f0-0000-1000-8000-00805f9b34fb', // SPP-like service
];

export const PRINTER_CHARACTERISTIC_UUIDS = [
  '0000ff02-0000-1000-8000-00805f9b34fb', // Common write characteristic
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // Microchip TX
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART TX
];
