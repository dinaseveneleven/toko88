export interface ProductVariant {
  code: string;        // Variant code/SKU (e.g., "RED", "BLUE", "XL")
  name: string;        // Variant display name (e.g., "Merah", "Biru", "XL")
  stock: number;       // Stock for this specific variant
  retailPrice?: number;  // Optional: variant-specific retail price (uses product price if not set)
  bulkPrice?: number;    // Optional: variant-specific bulk price (uses product price if not set)
}

export interface Product {
  id: string;
  name: string;
  retailPrice: number;
  bulkPrice: number;
  purchasePrice: number; // Harga Beli / Modal
  stock: number;         // Total stock (sum of variants if they exist, otherwise main stock)
  category: string;
  variants?: ProductVariant[];  // Optional for backward compatibility
}

export interface CartItem {
  product: Product;
  quantity: number;
  priceType: 'retail' | 'bulk';
  discount?: number; // Item-level discount in Rupiah
  variantCode?: string;  // Which variant was selected (if product has variants)
  variantName?: string;  // Display name of selected variant
}

export interface BankInfo {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export interface StoreInfo {
  address: string;
  phone: string;
}

export interface ReceiptData {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  timestamp: Date;
  customerPhone?: string;
  customerName?: string;
  bankInfo?: BankInfo;
  storeInfo?: StoreInfo;
  printWorkerCopy?: boolean;
}

export type ReceiptDeliveryMethod = 'display' | 'barcode' | 'whatsapp' | 'bluetooth';
