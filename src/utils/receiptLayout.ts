import { ReceiptData, CartItem } from '@/types/pos';

// Fixed column widths for 80mm paper (48 chars normal, 24 chars double-size)
const LINE_WIDTH = 48;
const LINE_WIDTH_DOUBLE = 24;

// Column widths for item lines (must be consistent!)
// Qty column on left, then gap, then name, then total
const QTY_COL = 6;
const GAP_COL = 2; // Space between qty and name
const NAME_COL = 26;
const TOTAL_COL = 14; // QTY_COL + GAP_COL + NAME_COL + TOTAL_COL = 48

// Helper to format Rupiah without symbol for receipt (compact)
const formatRupiah = (num: number): string => {
  return new Intl.NumberFormat('id-ID').format(num);
};

// Pad text to fixed width (right padding)
const padRight = (text: string, width: number): string => {
  return text.slice(0, width).padEnd(width, ' ');
};

// Pad text to fixed width (left padding)  
const padLeft = (text: string, width: number): string => {
  return text.slice(0, width).padStart(width, ' ');
};

// Center text in fixed width
const centerText = (text: string, width: number): string => {
  if (text.length >= width) return text.slice(0, width);
  const padding = width - text.length;
  const leftPad = Math.floor(padding / 2);
  return ' '.repeat(leftPad) + text + ' '.repeat(padding - leftPad);
};

// Create separator line
const createSeparator = (char: string = '-', width: number = LINE_WIDTH): string => {
  return char.repeat(width);
};

// Format two-column line with fixed positions
const formatTwoColumn = (left: string, right: string, width: number = LINE_WIDTH): string => {
  const rightStr = right.slice(0, Math.floor(width / 2));
  const leftStr = left.slice(0, width - rightStr.length - 1);
  return leftStr + ' '.repeat(width - leftStr.length - rightStr.length) + rightStr;
};

// Build invoice lines (customer receipt)
export const buildInvoiceLines = (
  receipt: ReceiptData, 
  storeInfo?: { address: string; phone: string }
): string[] => {
  const lines: string[] = [];
  
  // Header (will be printed centered with special formatting)
  lines.push('@@CENTER@@TOKO BESI 88@@DOUBLE@@');
  
  const address = storeInfo?.address || receipt.storeInfo?.address || 'Jl. Raya No. 88';
  const phone = storeInfo?.phone || receipt.storeInfo?.phone || '(021) 1234-5678';
  lines.push('@@CENTER@@' + address);
  lines.push('@@CENTER@@Tel: ' + phone);
  lines.push(createSeparator('-'));
  
  // Transaction info
  lines.push(formatTwoColumn('No:', receipt.id));
  lines.push(formatTwoColumn('Tanggal:', receipt.timestamp.toLocaleDateString('id-ID', { 
    day: '2-digit', month: 'short', year: 'numeric' 
  })));
  lines.push(formatTwoColumn('Waktu:', receipt.timestamp.toLocaleTimeString('id-ID')));
  lines.push(formatTwoColumn('Nama Pelanggan:', (receipt.customerName || '-').slice(0, 20)));
  lines.push(createSeparator('-'));
  
  // Items header - FIXED columns (Qty on left) - BOLD
  const hdrLine = padRight('Qty', QTY_COL) + ' '.repeat(GAP_COL) + padRight('Item', NAME_COL) + padLeft('Total', TOTAL_COL);
  lines.push('@@BOLD@@' + hdrLine);
  lines.push(createSeparator('-'));
  
  // Items
  for (const item of receipt.items) {
    const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
    const itemTotal = price * item.quantity;
    const itemDiscount = item.discount || 0;
    const finalTotal = Math.max(0, itemTotal - itemDiscount);
    
    // Line 1: qty | gap | Name | total - FIXED columns, BOLD
    const nameStr = item.product.name;
    const qtyStr = `${item.quantity}x`;
    const totalStr = `Rp${formatRupiah(finalTotal)}`;
    
    const itemLine = padRight(qtyStr, QTY_COL) + ' '.repeat(GAP_COL) + padRight(nameStr, NAME_COL) + padLeft(totalStr, TOTAL_COL);
    lines.push('@@BOLD@@' + itemLine);
    
    // Line 2: @ unit price (right aligned using padding)
    const unitPriceStr = `@ Rp${formatRupiah(price)}`;
    lines.push(padLeft(unitPriceStr, LINE_WIDTH));
    
    // Item discount if any
    if (itemDiscount > 0) {
      lines.push(`  Diskon: -Rp${formatRupiah(itemDiscount)}`);
    }
  }
  
  lines.push(createSeparator('-'));
  
  // Totals
  lines.push(formatTwoColumn('Subtotal:', `Rp${formatRupiah(receipt.subtotal)}`));
  if (receipt.discount > 0) {
    lines.push(formatTwoColumn('Diskon:', `-Rp${formatRupiah(receipt.discount)}`));
  }
  lines.push('@@BOLD@@' + formatTwoColumn('TOTAL:', `Rp${formatRupiah(receipt.total)}`));
  lines.push(createSeparator('-'));
  
  // Payment
  const paymentLabels: Record<string, string> = {
    'cash': 'Tunai',
    'qris': 'QRIS',
    'transfer': 'Transfer Bank',
  };
  lines.push(formatTwoColumn('Pembayaran:', paymentLabels[receipt.paymentMethod] || receipt.paymentMethod));
  
  if (receipt.cashReceived) {
    lines.push(formatTwoColumn('Tunai:', `Rp${formatRupiah(receipt.cashReceived)}`));
    lines.push('@@BOLD@@' + formatTwoColumn('Kembalian:', `Rp${formatRupiah(receipt.change || 0)}`));
  }
  
  // Bank transfer info
  if (receipt.paymentMethod === 'transfer' && receipt.bankInfo) {
    lines.push(createSeparator('-'));
    lines.push('@@BOLD@@Transfer ke:');
    lines.push(formatTwoColumn('Bank:', receipt.bankInfo.bankName));
    lines.push(formatTwoColumn('No.Rek:', receipt.bankInfo.accountNumber));
    lines.push(formatTwoColumn('A/N:', receipt.bankInfo.accountHolder));
  }
  
  lines.push(createSeparator('-'));
  
  // Footer
  lines.push('@@CENTER@@@@BOLD@@Terima Kasih!');
  lines.push('@@CENTER@@Barang yang sudah dibeli');
  lines.push('@@CENTER@@tidak dapat ditukar/dikembalikan');
  lines.push(createSeparator('-'));
  lines.push('@@CENTER@@*** SIMPAN STRUK INI ***');
  
  return lines;
};

// Build worker copy lines (carbon copy) - for double-size printing
export const buildWorkerCopyLines = (receipt: ReceiptData): string[] => {
  const lines: string[] = [];
  const W = LINE_WIDTH_DOUBLE; // 24 chars for double-size
  
  // Header
  lines.push('@@CENTER@@NOTA GUDANG@@DOUBLE@@');
  lines.push(createSeparator('-', LINE_WIDTH));
  
  // Customer name - BIG (double size)
  const customerName = (receipt.customerName || 'PELANGGAN').toUpperCase();
  lines.push('@@CENTER@@' + customerName + '@@DOUBLE@@');
  
  // Date & Time (normal size)
  const dateStr = receipt.timestamp.toLocaleDateString('id-ID', { 
    day: '2-digit', month: 'short', year: 'numeric' 
  });
  const timeStr = receipt.timestamp.toLocaleTimeString('id-ID', { 
    hour: '2-digit', minute: '2-digit' 
  });
  lines.push('@@CENTER@@' + dateStr + ' ' + timeStr);
  lines.push(createSeparator('-', LINE_WIDTH));
  
  // Items - Name and Quantity (double size, 24 char width)
  // Format: name on left (up to 16 chars), qty on right (8 chars for up to 5 digits)
  const ITEM_NAME_W = 16;
  const ITEM_QTY_W = 8;
  
  for (const item of receipt.items) {
    const productName = item.product.name;
    const qtyStr = `${item.quantity}x`;
    
    // If name is too long, wrap to multiple lines
    if (productName.length > ITEM_NAME_W) {
      // First line: first part of name + qty (centered)
      const firstPart = productName.slice(0, ITEM_NAME_W);
      const itemLine = padRight(firstPart, ITEM_NAME_W) + padLeft(qtyStr, ITEM_QTY_W);
      lines.push('@@CENTER@@@@DOUBLE@@' + itemLine);
      
      // Subsequent lines: rest of name (no qty, centered)
      let remaining = productName.slice(ITEM_NAME_W);
      while (remaining.length > 0) {
        const part = remaining.slice(0, W);
        lines.push('@@CENTER@@@@DOUBLE@@' + part);
        remaining = remaining.slice(W);
      }
    } else {
      // Single line (centered)
      const itemLine = padRight(productName, ITEM_NAME_W) + padLeft(qtyStr, ITEM_QTY_W);
      lines.push('@@CENTER@@@@DOUBLE@@' + itemLine);
    }
    
    // Add spacing between items
    lines.push('');
  }
  
  lines.push(createSeparator('-', LINE_WIDTH));
  
  // Footer
  lines.push('@@CENTER@@@@BOLD@@COPY UNTUK PERSIAPAN');
  
  return lines;
};

// Render lines as plain text (for preview) - strips formatting tags
export const renderPlainText = (lines: string[]): string => {
  return lines.map(line => {
    // Remove formatting tags
    return line
      .replace(/@@CENTER@@/g, '')
      .replace(/@@BOLD@@/g, '')
      .replace(/@@DOUBLE@@/g, '');
  }).join('\n');
};

// Export constants for use in escpos.ts
export { LINE_WIDTH, LINE_WIDTH_DOUBLE, formatRupiah, padRight, padLeft, centerText };
