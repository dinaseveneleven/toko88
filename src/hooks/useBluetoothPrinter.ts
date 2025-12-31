import { useState, useCallback, useEffect } from 'react';
import { ReceiptData } from '@/types/pos';
import { buildReceiptBytes, buildWorkerCopyBytes, isBluetoothSupported, PRINTER_SERVICE_UUIDS, PRINTER_CHARACTERISTIC_UUIDS } from '@/utils/escpos';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// Web Bluetooth API types (not yet in TS lib by default)
/* eslint-disable @typescript-eslint/no-explicit-any */
type BluetoothDevice = any;
type BluetoothRemoteGATTCharacteristic = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CHUNK_SIZE = 512; // Max bytes per write

interface BluetoothPrinterState {
  isConnected: boolean;
  isConnecting: boolean;
  isPrinting: boolean;
  printerName: string | null;
  savedPrinterName: string | null;
  error: string | null;
}

export function useBluetoothPrinter() {
  const [state, setState] = useState<BluetoothPrinterState>({
    isConnected: false,
    isConnecting: false,
    isPrinting: false,
    printerName: null,
    savedPrinterName: null,
    error: null,
  });
  
  const [device, setDevice] = useState<BluetoothDevice | null>(null);
  const [characteristic, setCharacteristic] = useState<BluetoothRemoteGATTCharacteristic | null>(null);

  // Auto-reconnect to saved printer on mount
  useEffect(() => {
    const autoReconnect = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: config, error } = await supabase
          .from('printer_configs')
          .select('printer_name, printer_device_id, is_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error loading printer config:', error);
          return;
        }

        if (config?.printer_name && config.is_enabled) {
          setState(prev => ({ 
            ...prev, 
            savedPrinterName: config.printer_name,
            printerName: `Tersimpan: ${config.printer_name}`
          }));

          // Try to auto-reconnect using getDevices() API
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nav = navigator as any;
          if (nav.bluetooth?.getDevices) {
            try {
              const devices = await nav.bluetooth.getDevices();
              const savedDevice = devices.find((d: BluetoothDevice) => 
                d.name === config.printer_name || d.id === config.printer_device_id
              );
              
              if (savedDevice && savedDevice.gatt) {
                console.log('Auto-reconnecting to saved printer:', savedDevice.name);
                setState(prev => ({ ...prev, isConnecting: true }));
                
                const server = await savedDevice.gatt.connect();
                
                // Find write characteristic
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

                if (writeCharacteristic) {
                  setDevice(savedDevice);
                  setCharacteristic(writeCharacteristic);
                  setState(prev => ({
                    ...prev,
                    isConnected: true,
                    isConnecting: false,
                    printerName: savedDevice.name || config.printer_name,
                  }));
                  console.log('Auto-reconnected to printer successfully');
                } else {
                  setState(prev => ({ ...prev, isConnecting: false }));
                }
              }
            } catch (err) {
              console.log('Auto-reconnect failed (user may need to pair again):', err);
              setState(prev => ({ ...prev, isConnecting: false }));
            }
          }
        }
      } catch (error) {
        console.error('Error in auto-reconnect:', error);
      }
    };

    if (isBluetoothSupported()) {
      autoReconnect();
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

      // Save printer config to database
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: upsertError } = await supabase
          .from('printer_configs')
          .upsert({
            user_id: user.id,
            printer_name: bluetoothDevice.name || 'Thermal Printer',
            printer_device_id: bluetoothDevice.id,
            is_enabled: true,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id'
          });

        if (upsertError) {
          console.error('Error saving printer config:', upsertError);
        }
      }
      
      setDevice(bluetoothDevice);
      setCharacteristic(writeCharacteristic);
      
      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        printerName: bluetoothDevice.name || 'Thermal Printer',
        savedPrinterName: bluetoothDevice.name || 'Thermal Printer',
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
    
    // Keep savedPrinterName so user knows their config is saved
    setState(prev => ({
      isConnected: false,
      isConnecting: false,
      isPrinting: false,
      printerName: prev.savedPrinterName ? `Tersimpan: ${prev.savedPrinterName}` : null,
      savedPrinterName: prev.savedPrinterName,
      error: null,
    }));

    toast({
      title: 'Printer Diputus',
      description: 'Koneksi dengan printer telah diputus. Konfigurasi tetap tersimpan.',
    });
  }, [device]);

  // Helper function to send bytes to printer with retry logic
  const sendBytesToPrinter = useCallback(async (bytes: Uint8Array, char: BluetoothRemoteGATTCharacteristic, retries = 2): Promise<void> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
          const chunk = bytes.slice(i, i + CHUNK_SIZE);
          
          // Try writeValueWithoutResponse first (faster), fallback to writeValue
          try {
            if (char.properties.writeWithoutResponse) {
              await char.writeValueWithoutResponse(chunk);
            } else if (char.properties.write) {
              await char.writeValue(chunk);
            } else {
              throw new Error('No writable property on characteristic');
            }
          } catch (writeError) {
            // If writeValueWithoutResponse fails, try writeValue
            if (char.properties.write) {
              await char.writeValue(chunk);
            } else {
              throw writeError;
            }
          }
          
          // Small delay between chunks (increase for stability)
          await new Promise(resolve => setTimeout(resolve, 80));
        }
        // Success, exit retry loop
        return;
      } catch (error) {
        console.warn(`Print attempt ${attempt + 1} failed:`, error);
        if (attempt < retries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          throw error;
        }
      }
    }
  }, []);

  const printReceipt = useCallback(async (
    receipt: ReceiptData, 
    storeInfo?: { address: string; phone: string },
    printWorkerCopy: boolean = true // Default to printing worker copy
  ): Promise<boolean> => {
    // IMPORTANT: Do not auto-trigger pairing prompts during checkout.
    // Users must connect manually using the Connect button beforehand.
    if (!characteristic || !state.isConnected) {
      toast({
        title: 'Printer Belum Terhubung',
        description: 'Hubungkan printer terlebih dahulu (sekali), lalu cetak akan cepat tanpa popup pairing.',
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({ ...prev, isPrinting: true, error: null }));

    try {
      // 1. Print Customer Invoice first
      const receiptBytes = buildReceiptBytes(receipt, storeInfo);
      await sendBytesToPrinter(receiptBytes, characteristic);
      
      // Wait for first print to complete and paper to be cut
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 2. Print Worker Copy (carbon copy with big text) as separate job
      if (printWorkerCopy) {
        const workerCopyBytes = buildWorkerCopyBytes(receipt);
        await sendBytesToPrinter(workerCopyBytes, characteristic);
      }

      setState(prev => ({ ...prev, isPrinting: false }));

      toast({
        title: 'Struk Dicetak',
        description: printWorkerCopy 
          ? 'Struk pelanggan & copy dapur berhasil dicetak.' 
          : 'Struk berhasil dicetak ke thermal printer.',
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
  }, [characteristic, state.isConnected, sendBytesToPrinter]);

  // Print ONLY the customer invoice (no carbon copy)
  const printInvoiceOnly = useCallback(async (
    receipt: ReceiptData, 
    storeInfo?: { address: string; phone: string }
  ): Promise<boolean> => {
    if (!state.isConnected) {
      toast({
        title: 'Printer Belum Terhubung',
        description: 'Hubungkan printer terlebih dahulu.',
        variant: 'destructive',
      });
      return false;
    }

    // Check if characteristic is still valid, if not try to get it from device
    let activeChar = characteristic;
    if (!activeChar && device?.gatt?.connected) {
      console.log('Characteristic lost, attempting to recover...');
      try {
        const server = device.gatt;
        for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
          try {
            const service = await server.getPrimaryService(serviceUuid);
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                activeChar = char;
                setCharacteristic(char);
                break;
              }
            }
            if (activeChar) break;
          } catch { /* try next service */ }
        }
      } catch (err) {
        console.error('Failed to recover characteristic:', err);
      }
    }

    if (!activeChar) {
      toast({
        title: 'Printer Error',
        description: 'Koneksi printer bermasalah. Coba disconnect dan connect ulang.',
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({ ...prev, isPrinting: true, error: null }));

    try {
      const receiptBytes = buildReceiptBytes(receipt, storeInfo);
      await sendBytesToPrinter(receiptBytes, activeChar);

      setState(prev => ({ ...prev, isPrinting: false }));

      toast({
        title: 'Invoice Dicetak',
        description: 'Struk pelanggan berhasil dicetak.',
      });

      return true;
    } catch (error) {
      console.error('Print error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Gagal mencetak';
      
      // If GATT error, suggest reconnecting
      const isGattError = errorMessage.includes('GATT') || errorMessage.includes('NotSupported');
      
      setState(prev => ({ ...prev, isPrinting: false, error: errorMessage }));
      toast({ 
        title: 'Gagal Mencetak', 
        description: isGattError 
          ? 'Koneksi Bluetooth error. Coba disconnect lalu connect ulang printer.' 
          : errorMessage, 
        variant: 'destructive' 
      });
      return false;
    }
  }, [characteristic, device, state.isConnected, sendBytesToPrinter]);

  // Print ONLY the carbon copy / worker copy
  const printCarbonCopyOnly = useCallback(async (receipt: ReceiptData): Promise<boolean> => {
    if (!state.isConnected) {
      toast({
        title: 'Printer Belum Terhubung',
        description: 'Hubungkan printer terlebih dahulu.',
        variant: 'destructive',
      });
      return false;
    }

    // Check if characteristic is still valid
    let activeChar = characteristic;
    if (!activeChar && device?.gatt?.connected) {
      console.log('Characteristic lost, attempting to recover...');
      try {
        const server = device.gatt;
        for (const serviceUuid of PRINTER_SERVICE_UUIDS) {
          try {
            const service = await server.getPrimaryService(serviceUuid);
            const characteristics = await service.getCharacteristics();
            for (const char of characteristics) {
              if (char.properties.write || char.properties.writeWithoutResponse) {
                activeChar = char;
                setCharacteristic(char);
                break;
              }
            }
            if (activeChar) break;
          } catch { /* try next service */ }
        }
      } catch (err) {
        console.error('Failed to recover characteristic:', err);
      }
    }

    if (!activeChar) {
      toast({
        title: 'Printer Error',
        description: 'Koneksi printer bermasalah. Coba disconnect dan connect ulang.',
        variant: 'destructive',
      });
      return false;
    }

    setState(prev => ({ ...prev, isPrinting: true, error: null }));

    try {
      const workerCopyBytes = buildWorkerCopyBytes(receipt);
      await sendBytesToPrinter(workerCopyBytes, activeChar);

      setState(prev => ({ ...prev, isPrinting: false }));

      toast({
        title: 'Carbon Copy Dicetak',
        description: 'Salinan pekerja berhasil dicetak.',
      });

      return true;
    } catch (error) {
      console.error('Print error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Gagal mencetak';
      
      const isGattError = errorMessage.includes('GATT') || errorMessage.includes('NotSupported');
      
      setState(prev => ({ ...prev, isPrinting: false, error: errorMessage }));
      toast({ 
        title: 'Gagal Mencetak', 
        description: isGattError 
          ? 'Koneksi Bluetooth error. Coba disconnect lalu connect ulang printer.' 
          : errorMessage, 
        variant: 'destructive' 
      });
      return false;
    }
  }, [characteristic, device, state.isConnected, sendBytesToPrinter]);

  return {
    ...state,
    isSupported: isBluetoothSupported(),
    hasSavedPrinter: !!state.savedPrinterName,
    connectPrinter,
    disconnectPrinter,
    printReceipt,
    printInvoiceOnly,
    printCarbonCopyOnly,
  };
}
