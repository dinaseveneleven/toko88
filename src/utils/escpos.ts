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

// Paper control - Blueprint Lite 80x compatible
const FEED_LINE = [LF];
// GS V 66 n - Feed and cut (Function B) - feeds n/10 mm then partial cut
// This is more compatible with Blueprint Lite 80x
const CUT_WITH_FEED = (feedAmount: number) => [GS, 0x56, 0x42, feedAmount]; // GS V B n
const CUT_PAPER = [GS, 0x56, 0x42, 80]; // Feed ~8mm then partial cut
const PARTIAL_CUT = [GS, 0x56, 0x01]; // Partial cut (no feed)

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

// Format a single item line for receipt - matches preview exactly
const formatItemLine = (item: CartItem, lineWidth: number = LINE_WIDTH_80MM): number[][] => {
  const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
  const priceLabel = item.priceType === 'retail' ? '(E)' : '(G)';
  const itemTotal = price * item.quantity;
  const itemDiscount = item.discount || 0;
  const finalTotal = Math.max(0, itemTotal - itemDiscount);
  
  const lines: number[][] = [];
  
  // Line 1: Product name (E/G)  |  Qty  |  Total
  const productName = `${item.product.name} ${priceLabel}`;
  const qtyStr = `${item.quantity}x`;
  const totalStr = `Rp ${formatRupiah(finalTotal)}`;
  
  // Format: Name (left), Qty (middle), Total (right)
  const nameWidth = lineWidth - 8 - totalStr.length; // 8 for qty column
  const namePart = productName.slice(0, nameWidth).padEnd(nameWidth, ' ');
  const qtyPart = qtyStr.padStart(6, ' ');
  
  lines.push([...textToBytes(namePart + qtyPart + '  ' + totalStr), LF]);
  
  // Line 2: @ unit price (right aligned, indented)
  const unitPriceStr = `@ Rp ${formatRupiah(price)}`;
  lines.push([...ALIGN_RIGHT, ...textToBytes(unitPriceStr), LF, ...ALIGN_LEFT]);
  
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
  
  // ===== HEADER (centered) - matches preview =====
  bytes.push(...ALIGN_CENTER);
  bytes.push(...BOLD_ON);
  bytes.push(...DOUBLE_SIZE);
  bytes.push(...textToBytes('TOKO 88'), LF);
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  
  // Store info (smaller text, centered)
  const address = storeInfo?.address || receipt.storeInfo?.address || 'Jl. Raya No. 88';
  const phone = storeInfo?.phone || receipt.storeInfo?.phone || '(021) 1234-5678';
  bytes.push(...textToBytes(address.slice(0, LINE_WIDTH)), LF);
  bytes.push(...textToBytes(`Tel: ${phone}`), LF);
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // ===== TRANSACTION INFO (left aligned, two-column) =====
  bytes.push(...ALIGN_LEFT);
  bytes.push(...formatTwoColumn('No:', receipt.id, LINE_WIDTH));
  bytes.push(...formatTwoColumn('Tanggal:', receipt.timestamp.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }), LINE_WIDTH));
  bytes.push(...formatTwoColumn('Waktu:', receipt.timestamp.toLocaleTimeString('id-ID'), LINE_WIDTH));
  if (receipt.customerName) {
    bytes.push(...formatTwoColumn('Pelanggan:', receipt.customerName.slice(0, 20), LINE_WIDTH));
  }
  bytes.push(...formatTwoColumn('Kasir:', 'Admin', LINE_WIDTH));
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // ===== ITEMS (matches preview: Name (E/G) | Qty | Total, then @ price) =====
  // Header row
  const hdrName = 'Item';
  const hdrQty = 'Qty';
  const hdrTotal = 'Total';
  const hdrLine = hdrName.padEnd(LINE_WIDTH - 6 - 12) + hdrQty.padStart(6) + hdrTotal.padStart(12);
  bytes.push(...textToBytes(hdrLine), LF);
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  for (const item of receipt.items) {
    const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
    const priceLabel = item.priceType === 'retail' ? 'E' : 'G';
    const itemTotal = price * item.quantity;
    const itemDiscount = item.discount || 0;
    const finalTotal = Math.max(0, itemTotal - itemDiscount);
    
    // Line 1: Name (E) | qty | total
    const nameStr = `${item.product.name} (${priceLabel})`;
    const qtyStr = `${item.quantity}x`;
    const totalStr = `Rp${formatRupiah(finalTotal)}`;
    
    const nameWidth = LINE_WIDTH - 6 - totalStr.length - 1;
    const itemLine = nameStr.slice(0, nameWidth).padEnd(nameWidth) + qtyStr.padStart(6) + ' ' + totalStr;
    bytes.push(...textToBytes(itemLine), LF);
    
    // Line 2: @ unit price (right aligned)
    const unitPriceStr = `@ Rp${formatRupiah(price)}`;
    bytes.push(...ALIGN_RIGHT);
    bytes.push(...textToBytes(unitPriceStr), LF);
    bytes.push(...ALIGN_LEFT);
    
    // Item discount if any
    if (itemDiscount > 0) {
      bytes.push(...textToBytes(`  Diskon: -Rp${formatRupiah(itemDiscount)}`), LF);
    }
  }
  
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // ===== TOTALS =====
  bytes.push(...formatTwoColumn('Subtotal:', `Rp${formatRupiah(receipt.subtotal)}`, LINE_WIDTH));
  if (receipt.discount > 0) {
    bytes.push(...formatTwoColumn('Diskon:', `-Rp${formatRupiah(receipt.discount)}`, LINE_WIDTH));
  }
  // Total row with emphasis
  bytes.push(...BOLD_ON);
  bytes.push(...formatTwoColumn('TOTAL:', `Rp${formatRupiah(receipt.total)}`, LINE_WIDTH));
  bytes.push(...BOLD_OFF);
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // ===== PAYMENT INFO =====
  const paymentLabels: Record<string, string> = {
    'cash': 'Tunai',
    'qris': 'QRIS',
    'transfer': 'Transfer Bank',
  };
  bytes.push(...formatTwoColumn('Pembayaran:', paymentLabels[receipt.paymentMethod] || receipt.paymentMethod, LINE_WIDTH));
  
  if (receipt.cashReceived) {
    bytes.push(...formatTwoColumn('Tunai:', `Rp${formatRupiah(receipt.cashReceived)}`, LINE_WIDTH));
    bytes.push(...BOLD_ON);
    bytes.push(...formatTwoColumn('Kembalian:', `Rp${formatRupiah(receipt.change || 0)}`, LINE_WIDTH));
    bytes.push(...BOLD_OFF);
  }
  
  // Bank transfer info
  if (receipt.paymentMethod === 'transfer' && receipt.bankInfo) {
    bytes.push(...createSeparator('-', LINE_WIDTH));
    bytes.push(...BOLD_ON);
    bytes.push(...textToBytes('Transfer ke:'), LF);
    bytes.push(...BOLD_OFF);
    bytes.push(...formatTwoColumn('Bank:', receipt.bankInfo.bankName, LINE_WIDTH));
    bytes.push(...formatTwoColumn('No.Rek:', receipt.bankInfo.accountNumber, LINE_WIDTH));
    bytes.push(...formatTwoColumn('A/N:', receipt.bankInfo.accountHolder, LINE_WIDTH));
  }
  
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // ===== FOOTER (centered) =====
  bytes.push(...ALIGN_CENTER);
  bytes.push(...BOLD_ON);
  bytes.push(...textToBytes('Terima Kasih!'), LF);
  bytes.push(...BOLD_OFF);
  bytes.push(...textToBytes('Barang yang sudah dibeli'), LF);
  bytes.push(...textToBytes('tidak dapat ditukar/dikembalikan'), LF);
  bytes.push(...createSeparator('-', LINE_WIDTH));
  bytes.push(...textToBytes('*** SIMPAN STRUK INI ***'), LF);
  bytes.push(LF);

  // Blueprint Lite 80x: Use GS V B n (Function B) - feeds n/10mm then partial cut
  // This avoids needing to press feed button manually
  bytes.push(...CUT_PAPER);

  return new Uint8Array(bytes);
};

// Build WORKER COPY receipt - BIG TEXT, only item names and quantities
// Works on both 50mm and 80mm paper - BLACK AND WHITE ONLY
export const buildWorkerCopyBytes = (receipt: ReceiptData): Uint8Array => {
  const bytes: number[] = [];
  const LINE_WIDTH = LINE_WIDTH_80MM;
  
  // Initialize printer
  bytes.push(...INIT);
  
  // ===== HEADER =====
  bytes.push(...ALIGN_CENTER);
  bytes.push(...BOLD_ON);
  bytes.push(...DOUBLE_SIZE);
  bytes.push(...textToBytes('SALINAN PEKERJA'), LF);
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // ===== CUSTOMER NAME - BIG =====
  bytes.push(...ALIGN_CENTER);
  bytes.push(...DOUBLE_SIZE);
  bytes.push(...BOLD_ON);
  const customerName = receipt.customerName || 'PELANGGAN';
  bytes.push(...textToBytes(customerName.slice(0, 20).toUpperCase()), LF);
  bytes.push(...NORMAL_SIZE);
  bytes.push(...BOLD_OFF);
  
  // ===== DATE & TIME =====
  bytes.push(...ALIGN_CENTER);
  const dateStr = receipt.timestamp.toLocaleDateString('id-ID', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric' 
  });
  const timeStr = receipt.timestamp.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  bytes.push(...textToBytes(`${dateStr} ${timeStr}`), LF);
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // ===== ITEMS - NAME AND QUANTITY =====
  bytes.push(...ALIGN_LEFT);
  
  for (const item of receipt.items) {
    bytes.push(...BOLD_ON);
    bytes.push(...DOUBLE_SIZE);
    
    // Product name and quantity on same line
    const productName = item.product.name;
    const qtyStr = `${item.quantity}x`;
    const nameWidth = 20;
    const itemLine = productName.slice(0, nameWidth).padEnd(nameWidth) + qtyStr.padStart(4);
    bytes.push(...textToBytes(itemLine), LF);
    
    bytes.push(...NORMAL_SIZE);
    bytes.push(...BOLD_OFF);
  }
  
  bytes.push(...createSeparator('-', LINE_WIDTH));
  
  // ===== FOOTER =====
  bytes.push(...ALIGN_CENTER);
  bytes.push(...BOLD_ON);
  bytes.push(...textToBytes('COPY UNTUK PERSIAPAN'), LF);
  bytes.push(...BOLD_OFF);
  bytes.push(LF);

  // Blueprint Lite 80x: GS V B n - feeds n/10mm then cuts
  // Using higher feed amount (120 = 12mm) for carbon copy to ensure proper cut
  bytes.push(...CUT_WITH_FEED(120));

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
