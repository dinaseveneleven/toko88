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

// Paper widths (characters per line)
const LINE_WIDTH_80MM = 48; // 80mm paper = 48 chars (standard font)
const LINE_WIDTH_50MM = 32; // 50mm paper = 32 chars (standard font)
const LINE_WIDTH_80MM_DOUBLE = 24; // 80mm with double-width text
const LINE_WIDTH_50MM_DOUBLE = 16; // 50mm with double-width text

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
const createSeparator = (char: string = '-', width: number = LINE_WIDTH_80MM): number[] => {
  return [...textToBytes(char.repeat(width)), LF];
};

// Create double line separator
const createDoubleSeparator = (width: number = LINE_WIDTH_80MM): number[] => {
  return [...textToBytes('='.repeat(width)), LF];
};

// Format a single item line for receipt
const formatItemLine = (item: CartItem, lineWidth: number = LINE_WIDTH_80MM): number[][] => {
  const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
  const priceLabel = item.priceType === 'retail' ? '(E)' : '(G)';
  const itemTotal = price * item.quantity;
  const itemDiscount = item.discount || 0;
  const finalTotal = Math.max(0, itemTotal - itemDiscount);
  
  const lines: number[][] = [];
  
  // Product name with price type indicator
  const productName = `${item.product.name} ${priceLabel}`;
  lines.push([...textToBytes(productName.slice(0, lineWidth)), LF]);
  
  // Quantity x Price = Total (indented)
  const qtyPrice = `  ${item.quantity} x Rp ${formatRupiah(price)}`;
  const totalStr = `Rp ${formatRupiah(finalTotal)}`;
  const spaceBetween = lineWidth - qtyPrice.length - totalStr.length;
  
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
const formatTwoColumn = (left: string, right: string, lineWidth: number = LINE_WIDTH_80MM): number[] => {
  const spaceBetween = lineWidth - left.length - right.length;
  if (spaceBetween > 0) {
    return [...textToBytes(left + ' '.repeat(spaceBetween) + right), LF];
  }
  return [...textToBytes(left.slice(0, lineWidth - right.length - 1) + ' ' + right), LF];
};

// Build complete receipt as byte array (Customer Invoice)
export const buildReceiptBytes = (receipt: ReceiptData, storeInfo?: { address: string; phone: string }): Uint8Array => {
  const bytes: number[] = [];
  const LINE_WIDTH = LINE_WIDTH_80MM;
  
  // Initialize printer
  bytes.push(...INIT);
  
  // Store header (centered, bold)
  bytes.push(...ALIGN_CENTER);
  bytes.push(...createDoubleSeparator(LINE_WIDTH));
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
  bytes.push(...createDoubleSeparator(LINE_WIDTH));
  bytes.push(LF);
  
  // Receipt details (left aligned)
  bytes.push(...ALIGN_LEFT);
  bytes.push(...textToBytes(`No: ${receipt.id}`), LF);
  bytes.push(...textToBytes(`Tanggal: ${receipt.timestamp.toLocaleDateString('id-ID')}`), LF);
  bytes.push(...textToBytes(`Waktu: ${receipt.timestamp.toLocaleTimeString('id-ID')}`), LF);
  
  if (receipt.customerName) {
    bytes.push(...textToBytes(`Pelanggan: ${receipt.customerName.slice(0, 30)}`), LF);
  }
  
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // Items
  for (const item of receipt.items) {
    const itemLines = formatItemLine(item, LINE_WIDTH);
    for (const line of itemLines) {
      bytes.push(...line);
    }
  }
  
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // Totals
  bytes.push(...formatTwoColumn('Subtotal:', `Rp ${formatRupiah(receipt.subtotal)}`, LINE_WIDTH));
  
  if (receipt.discount > 0) {
    bytes.push(...formatTwoColumn('Diskon:', `-Rp ${formatRupiah(receipt.discount)}`, LINE_WIDTH));
  }
  
  bytes.push(...createSeparator('-', LINE_WIDTH));
  bytes.push(...BOLD_ON);
  bytes.push(...formatTwoColumn('TOTAL:', `Rp ${formatRupiah(receipt.total)}`, LINE_WIDTH));
  bytes.push(...BOLD_OFF);
  bytes.push(...createDoubleSeparator(LINE_WIDTH));
  
  // Payment info
  const paymentLabels: Record<string, string> = {
    'cash': 'Tunai',
    'qris': 'QRIS',
    'transfer': 'Transfer',
  };
  bytes.push(...formatTwoColumn('Pembayaran:', paymentLabels[receipt.paymentMethod] || receipt.paymentMethod, LINE_WIDTH));
  
  if (receipt.cashReceived) {
    bytes.push(...formatTwoColumn('Tunai:', `Rp ${formatRupiah(receipt.cashReceived)}`, LINE_WIDTH));
    bytes.push(...formatTwoColumn('Kembalian:', `Rp ${formatRupiah(receipt.change || 0)}`, LINE_WIDTH));
  }
  
  // Bank transfer info
  if (receipt.paymentMethod === 'transfer' && receipt.bankInfo) {
    bytes.push(LF);
    bytes.push(...textToBytes('Transfer ke:'), LF);
    bytes.push(...textToBytes(`Bank: ${receipt.bankInfo.bankName}`), LF);
    bytes.push(...textToBytes(`No.Rek: ${receipt.bankInfo.accountNumber}`), LF);
    bytes.push(...textToBytes(`A/N: ${receipt.bankInfo.accountHolder}`), LF);
  }
  
  bytes.push(...createDoubleSeparator(LINE_WIDTH));
  
  // Footer (centered)
  bytes.push(...ALIGN_CENTER);
  bytes.push(...textToBytes('Terima Kasih!'), LF);
  bytes.push(...textToBytes('Barang yang sudah dibeli'), LF);
  bytes.push(...textToBytes('tidak dapat ditukar/dikembalikan'), LF);
  bytes.push(...createDoubleSeparator(LINE_WIDTH));
  bytes.push(...textToBytes('*** SIMPAN STRUK INI ***'), LF);
  bytes.push(LF, LF, LF); // Feed some paper
  
  // Cut paper
  bytes.push(...CUT_PAPER);
  
  return new Uint8Array(bytes);
};

// Build WORKER COPY receipt - BIG TEXT for easy reading
// Works on both 50mm and 80mm paper
export const buildWorkerCopyBytes = (receipt: ReceiptData): Uint8Array => {
  const bytes: number[] = [];
  
  // Initialize printer
  bytes.push(...INIT);
  
  // ===== HEADER - DOUBLE SIZE =====
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_SIZE);
  bytes.push(...BOLD_ON);
  bytes.push(...textToBytes('PESANAN'), LF);
  bytes.push(...textToBytes('DAPUR'), LF);
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  
  bytes.push(...createDoubleSeparator(LINE_WIDTH_50MM_DOUBLE * 2));
  bytes.push(LF);
  
  // ===== ORDER INFO - DOUBLE WIDTH for visibility =====
  bytes.push(...ALIGN_LEFT);
  bytes.push(...DOUBLE_WIDTH);
  bytes.push(...BOLD_ON);
  
  // Order number (short format)
  const shortId = receipt.id.slice(-6).toUpperCase();
  bytes.push(...textToBytes(`#${shortId}`), LF);
  
  // Time only (more important than date for workers)
  bytes.push(...textToBytes(receipt.timestamp.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit' 
  })), LF);
  
  // Customer name if exists
  if (receipt.customerName) {
    bytes.push(...textToBytes(receipt.customerName.slice(0, 14)), LF);
  }
  
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  bytes.push(LF);
  
  bytes.push(...createDoubleSeparator(LINE_WIDTH_50MM_DOUBLE * 2));
  
  // ===== ITEMS - THE MOST IMPORTANT PART - DOUBLE SIZE =====
  bytes.push(...DOUBLE_SIZE);
  bytes.push(...BOLD_ON);
  bytes.push(...ALIGN_LEFT);
  
  for (const item of receipt.items) {
    // Quantity first (most important for workers)
    const qty = `${item.quantity}x`;
    bytes.push(...textToBytes(qty), LF);
    
    // Product name (wrap to fit double-size on 50mm = ~12 chars visible)
    const productName = item.product.name;
    // Split long names into chunks
    const maxChars = 12;
    for (let i = 0; i < productName.length; i += maxChars) {
      const chunk = productName.slice(i, i + maxChars);
      bytes.push(...textToBytes(` ${chunk}`), LF);
    }
    
    // Price type indicator
    const priceLabel = item.priceType === 'retail' ? 'ECER' : 'GROSIR';
    bytes.push(...textToBytes(` (${priceLabel})`), LF);
    
    bytes.push(LF); // Space between items
  }
  
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  
  bytes.push(...createDoubleSeparator(LINE_WIDTH_50MM_DOUBLE * 2));
  
  // ===== TOTAL - DOUBLE SIZE =====
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_SIZE);
  bytes.push(...BOLD_ON);
  bytes.push(...textToBytes('TOTAL:'), LF);
  bytes.push(...textToBytes(`Rp${formatRupiah(receipt.total)}`), LF);
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  
  bytes.push(LF);
  bytes.push(...createDoubleSeparator(LINE_WIDTH_50MM_DOUBLE * 2));
  
  // ===== FOOTER =====
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_HEIGHT);
  bytes.push(...BOLD_ON);
  bytes.push(...textToBytes('COPY DAPUR'), LF);
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  
  bytes.push(LF, LF, LF); // Feed paper
  
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
