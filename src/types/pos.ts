export interface Product {
  id: string;
  name: string;
  retailPrice: number;
  bulkPrice: number;
  purchasePrice: number; // Harga Beli / Modal
  stock: number;
  category: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  priceType: 'retail' | 'bulk';
  discount?: number; // Item-level discount percentage (0-100)
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
}

export type ReceiptDeliveryMethod = 'display' | 'barcode' | 'whatsapp';
