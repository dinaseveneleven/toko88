export interface Product {
  id: string;
  name: string;
  retailPrice: number;
  bulkPrice: number;
  stock: number;
  category: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  priceType: 'retail' | 'bulk';
}

export interface ReceiptData {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod: string;
  cashReceived?: number;
  change?: number;
  timestamp: Date;
  customerPhone?: string;
}

export type ReceiptDeliveryMethod = 'display' | 'barcode' | 'whatsapp';
