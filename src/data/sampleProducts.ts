import { Product } from '@/types/pos';

export const sampleProducts: Product[] = [
  { id: '1', name: 'Indomie Goreng', retailPrice: 3500, bulkPrice: 3000, stock: 150, category: 'Mie Instan' },
  { id: '2', name: 'Indomie Kuah Ayam', retailPrice: 3500, bulkPrice: 3000, stock: 120, category: 'Mie Instan' },
  { id: '3', name: 'Mie Sedaap Goreng', retailPrice: 3300, bulkPrice: 2800, stock: 80, category: 'Mie Instan' },
  { id: '4', name: 'Aqua 600ml', retailPrice: 4000, bulkPrice: 3500, stock: 200, category: 'Minuman' },
  { id: '5', name: 'Coca Cola 390ml', retailPrice: 7000, bulkPrice: 6000, stock: 48, category: 'Minuman' },
  { id: '6', name: 'Teh Botol Sosro 450ml', retailPrice: 5500, bulkPrice: 4800, stock: 72, category: 'Minuman' },
  { id: '7', name: 'Kopi Kapal Api Sachet', retailPrice: 2000, bulkPrice: 1700, stock: 300, category: 'Kopi' },
  { id: '8', name: 'Nescafe Classic 2g', retailPrice: 1500, bulkPrice: 1200, stock: 250, category: 'Kopi' },
  { id: '9', name: 'Good Day Cappuccino', retailPrice: 2500, bulkPrice: 2100, stock: 180, category: 'Kopi' },
  { id: '10', name: 'Gula Pasir 1kg', retailPrice: 15000, bulkPrice: 13500, stock: 35, category: 'Sembako' },
  { id: '11', name: 'Beras 5kg Premium', retailPrice: 75000, bulkPrice: 70000, stock: 20, category: 'Sembako' },
  { id: '12', name: 'Minyak Goreng 2L', retailPrice: 35000, bulkPrice: 32000, stock: 28, category: 'Sembako' },
  { id: '13', name: 'Telur Ayam 1kg', retailPrice: 28000, bulkPrice: 25000, stock: 15, category: 'Sembako' },
  { id: '14', name: 'Sabun Lifebuoy 80g', retailPrice: 4500, bulkPrice: 3800, stock: 60, category: 'Toiletries' },
  { id: '15', name: 'Shampoo Sunsilk 170ml', retailPrice: 18000, bulkPrice: 16000, stock: 25, category: 'Toiletries' },
  { id: '16', name: 'Pasta Gigi Pepsodent 120g', retailPrice: 12000, bulkPrice: 10500, stock: 40, category: 'Toiletries' },
  { id: '17', name: 'Chitato 68g', retailPrice: 12000, bulkPrice: 10000, stock: 55, category: 'Snack' },
  { id: '18', name: 'Oreo Original 133g', retailPrice: 10000, bulkPrice: 8500, stock: 42, category: 'Snack' },
  { id: '19', name: 'Tango Wafer 176g', retailPrice: 15000, bulkPrice: 13000, stock: 38, category: 'Snack' },
  { id: '20', name: 'Roti Sari Roti Tawar', retailPrice: 16000, bulkPrice: 14000, stock: 12, category: 'Roti' },
  { id: '21', name: 'Susu Ultra 250ml', retailPrice: 6000, bulkPrice: 5200, stock: 96, category: 'Minuman' },
  { id: '22', name: 'Yakult 5pcs', retailPrice: 12000, bulkPrice: 10500, stock: 30, category: 'Minuman' },
  { id: '23', name: 'Rokok Gudang Garam', retailPrice: 28000, bulkPrice: 26000, stock: 100, category: 'Rokok' },
  { id: '24', name: 'Rokok Djarum Super', retailPrice: 25000, bulkPrice: 23000, stock: 85, category: 'Rokok' },
];

export const categories = [...new Set(sampleProducts.map(p => p.category))];
