// Re-export everything from the context for backwards compatibility
export { useBluetoothPrinterContext as useBluetoothPrinter } from '@/contexts/BluetoothPrinterContext';

// Also export the utility function
export { isBluetoothSupported } from '@/utils/escpos';
