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

// Sanitize text for receipt printing - ensures preview matches print output
// Strips non-printable chars and normalizes to ASCII-safe characters
export const sanitizeReceiptText = (text: string): string => {
  if (!text) return '';
  // Replace non-ASCII and control chars with safe alternatives
  return text
    .normalize('NFD') // Decompose diacritics
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\x20-\x7E]/g, '?') // Replace non-printable with ?
    .trim();
};

// Helper to format Rupiah without symbol for receipt (compact)
// Guards against NaN/undefined to prevent layout corruption
const formatRupiah = (num: number): string => {
  const safeNum = Number(num) || 0;
  return new Intl.NumberFormat('id-ID').format(safeNum);
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
  
  const address = sanitizeReceiptText(storeInfo?.address || receipt.storeInfo?.address || 'Jl. Raya No. 88');
  const phone = sanitizeReceiptText(storeInfo?.phone || receipt.storeInfo?.phone || '(021) 1234-5678');
  lines.push('@@CENTER@@' + address);
  lines.push('@@CENTER@@Tel: ' + phone);
  lines.push(createSeparator('-'));
  
  // Transaction info
  lines.push(formatTwoColumn('No:', sanitizeReceiptText(receipt.id)));
  lines.push(formatTwoColumn('Tanggal:', receipt.timestamp.toLocaleDateString('id-ID', { 
    day: '2-digit', month: 'short', year: 'numeric' 
  })));
  lines.push(formatTwoColumn('Waktu:', receipt.timestamp.toLocaleTimeString('id-ID')));
  lines.push(formatTwoColumn('Nama Pelanggan:', sanitizeReceiptText((receipt.customerName || '-').slice(0, 20))));
  lines.push(createSeparator('-'));
  
  // Items section
  let totalBulkDiscount = 0;
  let totalItemDiscount = 0;
  let subtotalBeforeDiscount = 0;
  
  for (const item of receipt.items) {
    // Safely get numeric values with defaults
    const retailPrice = Number(item.product?.retailPrice) || 0;
    const bulkPrice = Number(item.product?.bulkPrice) || 0;
    const quantity = Number(item.quantity) || 1;
    
    const retailTotal = retailPrice * quantity;
    subtotalBeforeDiscount += retailTotal;
    
    // Calculate bulk discount (difference between retail and bulk price)
    const bulkDiscount = item.priceType === 'bulk' ? (retailPrice - bulkPrice) * quantity : 0;
    totalBulkDiscount += bulkDiscount;
    
    const itemDiscount = Number(item.discount) || 0;
    totalItemDiscount += itemDiscount;
    
    // Line 1: Item name only (left-aligned, BOLD)
    const nameStr = sanitizeReceiptText(item.product?.name || 'Item');
    lines.push('@@BOLD@@' + nameStr);
    
    // Line 2: "  2x @3.500" on left, subtotal on right (subtotal BOLD)
    const qtyPriceStr = `  ${quantity}x @${formatRupiah(retailPrice)}`;
    const subtotalStr = formatRupiah(retailTotal);
    const spacing = LINE_WIDTH - qtyPriceStr.length - subtotalStr.length;
    lines.push(qtyPriceStr + ' '.repeat(Math.max(1, spacing)) + '@@BOLD@@' + subtotalStr);
    
    // Line 3: Bulk discount if exists (right-aligned with minus)
    if (bulkDiscount > 0) {
      const discountStr = `-${formatRupiah(bulkDiscount)}`;
      lines.push(padLeft(discountStr, LINE_WIDTH));
    }
    
    // Line 4: Item discount if exists (right-aligned with minus)
    if (itemDiscount > 0) {
      const discountStr = `-${formatRupiah(itemDiscount)}`;
      lines.push(padLeft(discountStr, LINE_WIDTH));
    }
  }
  
  lines.push(createSeparator('-'));
  
  // Subtotal: total before any discounts
  lines.push(formatTwoColumn('Subtotal:', `Rp${formatRupiah(subtotalBeforeDiscount)}`));
  
  // Diskon: combine all discounts (bulk + item + global)
  const totalDiscount = totalBulkDiscount + totalItemDiscount + (receipt.discount || 0);
  if (totalDiscount > 0) {
    lines.push(formatTwoColumn('Diskon:', `-Rp${formatRupiah(totalDiscount)}`));
  }
  
  // Total: after all discounts
  const finalTotal = subtotalBeforeDiscount - totalDiscount;
  lines.push('@@BOLD@@' + formatTwoColumn('TOTAL:', `Rp${formatRupiah(finalTotal)}`));
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
  
  // Customer name - BIG (double size) - sanitize for print
  const customerName = sanitizeReceiptText((receipt.customerName || 'PELANGGAN').toUpperCase());
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
  // Dynamically adjust column widths based on longest qty string
  const maxQtyLen = Math.max(...receipt.items.map(item => `${Number(item.quantity) || 1}x`.length));
  const ITEM_QTY_W = Math.max(4, maxQtyLen + 1); // Min 4 chars, +1 for spacing
  const ITEM_NAME_W = W - ITEM_QTY_W; // Remaining space for name
  
  for (const item of receipt.items) {
    const productName = sanitizeReceiptText(item.product?.name || 'Item');
    const qtyStr = `${Number(item.quantity) || 1}x`;
    
    // If name is too long, wrap to multiple lines
    if (productName.length > ITEM_NAME_W) {
      // First line: first part of name + qty
      const firstPart = productName.slice(0, ITEM_NAME_W);
      const itemLine = padRight(firstPart, ITEM_NAME_W) + padLeft(qtyStr, ITEM_QTY_W);
      lines.push('@@CENTER@@@@DOUBLE@@' + itemLine);
      
      // Subsequent lines: rest of name (no qty)
      let remaining = productName.slice(ITEM_NAME_W);
      while (remaining.length > 0) {
        const part = remaining.slice(0, W);
        lines.push('@@CENTER@@@@DOUBLE@@  ' + part); // Indent continuation
        remaining = remaining.slice(W);
      }
    } else {
      // Single line
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

// Render lines as plain text (for preview) - applies centering and strips other tags
export const renderPlainText = (lines: string[]): string => {
  return lines.map(line => {
    const shouldCenter = line.includes('@@CENTER@@');
    
    // Remove formatting tags
    let cleanLine = line
      .replace(/@@CENTER@@/g, '')
      .replace(/@@BOLD@@/g, '')
      .replace(/@@DOUBLE@@/g, '');
    
    // Center the line if it had @@CENTER@@ tag (always use full width for preview)
    if (shouldCenter && cleanLine.trim().length > 0) {
      cleanLine = centerText(cleanLine.trim(), LINE_WIDTH);
    }
    
    return cleanLine;
  }).join('\n');
};

// Export constants for use in escpos.ts
export { LINE_WIDTH, LINE_WIDTH_DOUBLE, formatRupiah, padRight, padLeft, centerText };
