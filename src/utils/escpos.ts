import { ReceiptData } from '@/types/pos';
import { buildInvoiceLines, buildWorkerCopyLines, LINE_WIDTH, LINE_WIDTH_DOUBLE } from './receiptLayout';

// ESC/POS Commands for thermal printers
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

// Initialize printer
const INIT = [ESC, 0x40];

// Text alignment
const ALIGN_LEFT = [ESC, 0x61, 0x00];
const ALIGN_CENTER = [ESC, 0x61, 0x01];

// Text style
const BOLD_ON = [ESC, 0x45, 0x01];
const BOLD_OFF = [ESC, 0x45, 0x00];
const DOUBLE_SIZE = [ESC, 0x21, 0x30];
const NORMAL_SIZE = [ESC, 0x21, 0x00];

// Paper control - Blueprint Lite 80x compatible
// GS V 66 n - Feed and cut (Function B) - feeds n/10 mm then partial cut
const CUT_WITH_FEED = (feedAmount: number) => [GS, 0x56, 0x42, feedAmount];
const CUT_PAPER = [GS, 0x56, 0x42, 80]; // Feed ~8mm then partial cut

// Convert string to byte array (ASCII)
const textToBytes = (text: string): number[] => {
  return Array.from(text).map(char => char.charCodeAt(0));
};

// Process a single line with formatting tags and output bytes
const processLine = (line: string, bytes: number[]): void => {
  const isCenter = line.includes('@@CENTER@@');
  const isBold = line.includes('@@BOLD@@');
  const isDouble = line.includes('@@DOUBLE@@');
  
  // Strip all tags
  let text = line
    .replace(/@@CENTER@@/g, '')
    .replace(/@@BOLD@@/g, '')
    .replace(/@@DOUBLE@@/g, '');
  
  // Apply formatting
  if (isCenter) bytes.push(...ALIGN_CENTER);
  if (isBold) bytes.push(...BOLD_ON);
  if (isDouble) bytes.push(...DOUBLE_SIZE);
  
  // Output text
  bytes.push(...textToBytes(text), LF);
  
  // Reset formatting
  if (isDouble) bytes.push(...NORMAL_SIZE);
  if (isBold) bytes.push(...BOLD_OFF);
  if (isCenter) bytes.push(...ALIGN_LEFT);
};

// Build complete receipt as byte array (Customer Invoice)
export const buildReceiptBytes = (receipt: ReceiptData, storeInfo?: { address: string; phone: string }): Uint8Array => {
  const bytes: number[] = [];
  
  // Initialize printer
  bytes.push(...INIT);
  
  // Get formatted lines from layout module
  const lines = buildInvoiceLines(receipt, storeInfo);
  
  // Process each line
  for (const line of lines) {
    processLine(line, bytes);
  }
  
  // Extra line feed before cut
  bytes.push(LF);
  
  // Blueprint Lite 80x: Use GS V B n (Function B) - feeds n/10mm then partial cut
  bytes.push(...CUT_PAPER);
  
  return new Uint8Array(bytes);
};

// Build WORKER COPY receipt - BIG TEXT, only item names and quantities
export const buildWorkerCopyBytes = (receipt: ReceiptData): Uint8Array => {
  const bytes: number[] = [];
  
  // Initialize printer
  bytes.push(...INIT);
  
  // Get formatted lines from layout module
  const lines = buildWorkerCopyLines(receipt);
  
  // Process each line
  for (const line of lines) {
    processLine(line, bytes);
  }
  
  // Extra line feed before cut (same as invoice)
  bytes.push(LF);
  
  // Use same cut command as invoice - consistent behavior
  bytes.push(...CUT_PAPER);
  
  return new Uint8Array(bytes);
};

// Check if Web Bluetooth is supported
export const isBluetoothSupported = (): boolean => {
  return 'bluetooth' in navigator;
};

// Common Bluetooth Serial Port Profile UUIDs for thermal printers
// Including RPP02N, XP-series, Blueprint, and other common ESC/POS printers
export const PRINTER_SERVICE_UUIDS = [
  // Generic Access & GATT (sometimes needed for discovery)
  '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
  '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
  '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
  
  // Common thermal printer services (RPP02N, XP-series, etc.)
  '000018f0-0000-1000-8000-00805f9b34fb', // SPP-like service (most common for RPP02N)
  '0000ff00-0000-1000-8000-00805f9b34fb', // Common thermal printer service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10/HM-16/HM-17 BLE modules
  '0000fff0-0000-1000-8000-00805f9b34fb', // Alternative thermal printer service
  
  // Vendor-specific services
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip/ISSC
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2', // Nordic UART Service
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART (alternative)
  
  // Additional printer-specific services
  '0000ae00-0000-1000-8000-00805f9b34fb', // Cat/pocket printer service
  '0000feea-0000-1000-8000-00805f9b34fb', // Some ESC/POS printers
];

export const PRINTER_CHARACTERISTIC_UUIDS = [
  // Common write characteristics for thermal printers
  '00002af1-0000-1000-8000-00805f9b34fb', // SPP write (RPP02N common)
  '0000ff02-0000-1000-8000-00805f9b34fb', // Common write characteristic
  '0000ffe1-0000-1000-8000-00805f9b34fb', // HM-10 TX characteristic
  '0000fff2-0000-1000-8000-00805f9b34fb', // Alternative write characteristic
  
  // Vendor-specific characteristics
  '49535343-8841-43f4-a8d4-ecbe34729bb3', // Microchip TX
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART TX
  
  // Additional printer characteristics
  '0000ae01-0000-1000-8000-00805f9b34fb', // Cat printer write
  '0000feec-0000-1000-8000-00805f9b34fb', // Some ESC/POS printers
];
