import { useState, useCallback, useEffect } from 'react';
import { ReceiptData } from '@/types/pos';
import { buildReceiptBytes, isBluetoothSupported, PRINTER_SERVICE_UUIDS, PRINTER_CHARACTERISTIC_UUIDS } from '@/utils/escpos';
import { toast } from '@/hooks/use-toast';

// Web Bluetooth API types (not yet in TS lib by default)
/* eslint-disable @typescript-eslint/no-explicit-any */
type BluetoothDevice = any;
type BluetoothRemoteGATTCharacteristic = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const STORAGE_KEY = 'bluetooth_printer_device_id';
const CHUNK_SIZE = 512; // Max bytes per write

interface BluetoothPrinterState {
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  printerName: string | null;
  error: string | null;
}

export function useBluetoothPrinter() {
  const [state, setState] = useState<BluetoothPrinterState>({
    isConnected: false,
    isConnecting: false,
    isPrinting: false,
    printerName: null,
    error: null,
  });
  
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [characteristic, setCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

  // Check for saved device on mount
  useEffect(() => {
    const savedDeviceId = localStorage.getItem(STORAGE_KEY);
    if (savedDeviceId && isBluetoothSupported()) {
      // We can't auto-reconnect without user gesture, but we can show that a device was previously connected
      setState(prev => ({ ...prev, printerName: `Tersimpan: ${savedDeviceId.slice(0, 8)}...` }));
    }
  }, []);

  // Handle device disconnect
  useEffect(() => {
    const handleDisconnect = () => {
      setState(prev => ({
        ...prev,
        isConnected: false,
        printerName: null,
        error: 'Printer terputus',
      }));
      setCharacteristic(null);
      toast({
        title: 'Printer Terputus',
        description: 'Koneksi Bluetooth dengan printer terputus.',
        variant: 'destructive',
      });
    };

    if (device) {
      device.addEventListener('gattserverdisconnected', handleDisconnect);
      return () => {
        device.removeEventListener('gattserverdisconnected', handleDisconnect);
      };
    }
  }, [device]);

  const connectPrinter = useCallback(async (): Promise<boolean> => {
    if (!isBluetoothSupported()) {
      toast({
        title: 'Bluetooth Tidak Didukung',
        description: 'Browser Anda tidak mendukung Web Bluetooth. Gunakan Chrome di Android.',
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      // Request device with filters for thermal printers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      const bluetoothDevice = await nav.bluetooth.requestDevice({
        // Accept all devices since printer names vary
        acceptAllDevices: true,
        optionalServices: PRINTER_SERVICE_UUIDS,
      });

      if (!bluetoothDevice.gatt) {
        throw new Error('GATT tidak tersedia');
      }

      setState(prev => ({ ...prev, printerName: bluetoothDevice.name || 'Unknown Printer' }));

      // Connect to GATT server
      const server = await bluetoothDevice.gatt.connect();

      // Try to find a suitable service and characteristic
      let writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;

      for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
        try {
          const service = await server.getPrimaryService(serviceUuid);
          
          for (const charUuid of PRINTER_CHARACTERISTIC_UUIDS) {
            try {
              const char = await service.getCharacteristic(charUuid);
              if (char.properties.write || char.properties.writeWithoutResponse) {
                writeCharacteristic = char;
                break;
              }
            } catch {
              // Try next characteristic
            }
          }
          
          if (writeCharacteristic) break;

          // If specific UUIDs don't work, try to get all characteristics
          const characteristics = await service.getCharacteristics();
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeCharacteristic = char;
              break;
            }
          }
          
          if (writeCharacteristic) break;
        } catch {
          // Service not found, try next
        }
      }

      if (!writeCharacteristic) {
        throw new Error('Tidak dapat menemukan karakteristik tulis pada printer');
      }

      // Save device ID for future reference
      localStorage.setItem(STORAGE_KEY, bluetoothDevice.id);
      
      setDevice(bluetoothDevice);
      setCharacteristic(writeCharacteristic);
      
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        printerName: bluetoothDevice.name || 'Thermal Printer',
      }));

      toast({
        title: 'Printer Terhubung',
        description: `Berhasil terhubung ke ${bluetoothDevice.name || 'printer'}`,
      });

      return true;
    } catch (error) {
      console.error('Bluetooth connection error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Gagal menghubungkan printer';
      
      setState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        error: errorMessage,
      }));

      // Don't show toast for user cancellation
      if (!errorMessage.includes('cancelled') && !errorMessage.includes('canceled')) {
        toast({
          title: 'Gagal Menghubungkan',
          description: errorMessage,
          variant: 'destructive',
        });
      }

      return false;
    }
  }, []);

  const disconnectPrinter = useCallback(() => {
    if (device?.gatt?.connected) {
      device.gatt.disconnect();
    }
    
    setDevice(null);
    setCharacteristic(null);
    localStorage.removeItem(STORAGE_KEY);
    
    setState({
      isConnected: false,
      isConnecting: false,
      isPrinting: false,
      printerName: null,
      error: null,
    });

    toast({
      title: 'Printer Diputus',
      description: 'Koneksi dengan printer telah diputus.',
    });
  }, [device]);

  const printReceipt = useCallback(async (
    receipt: ReceiptData, 
    storeInfo?: { address: string; phone: string }
  ): Promise<boolean> => {
    if (!characteristic) {
      // Try to connect first
      const connected = await connectPrinter();
      if (!connected) {
        return false;
      }
    }

    if (!characteristic) {
      toast({
        title: 'Printer Tidak Terhubung',
        description: 'Silakan hubungkan printer terlebih dahulu.',
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({ ...prev, isPrinting: true, error: null }));

    try {
      const receiptBytes = buildReceiptBytes(receipt, storeInfo);
      
      // Send data in chunks
      for (let i = 0; i < receiptBytes.length; i += CHUNK_SIZE) {
        const chunk = receiptBytes.slice(i, i + CHUNK_SIZE);
        
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        
        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setState(prev => ({ ...prev, isPrinting: false }));

      toast({
        title: 'Struk Dicetak',
        description: 'Struk berhasil dicetak ke thermal printer.',
      });

      return true;
    } catch (error) {
      console.error('Print error:', error);
      
      const errorMessage = error instanceof Error ? error.message : 'Gagal mencetak struk';
      
      setState(prev => ({
        ...prev,
        isPrinting: false,
        error: errorMessage,
      }));

      toast({
        title: 'Gagal Mencetak',
        description: errorMessage,
        variant: 'destructive',
      });

      return false;
    }
  }, [characteristic, connectPrinter]);

  return {
    ...state,
    isSupported: isBluetoothSupported(),
    connectPrinter,
    disconnectPrinter,
    printReceipt,
  };
}
