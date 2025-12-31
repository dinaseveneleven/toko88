import { Bluetooth, BluetoothOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBluetoothPrinter } from '@/hooks/useBluetoothPrinter';
import { isBluetoothSupported } from '@/utils/escpos';

export function BluetoothPrinterButton() {
  const { isConnected, isConnecting, printerName, connectPrinter, disconnectPrinter } = useBluetoothPrinter();

  // Don't render if Bluetooth is not supported
  if (!isBluetoothSupported()) {
    return null;
  }

  return (
    <div className="fixed bottom-20 right-4 z-40 md:bottom-4">
      {isConnected ? (
        <Button
          onClick={disconnectPrinter}
          variant="outline"
          size="sm"
          className="bg-card border-primary/50 text-primary hover:bg-primary/10 shadow-lg gap-2"
        >
          <Bluetooth className="w-4 h-4" />
          <span className="hidden sm:inline">{printerName || 'Printer'}</span>
          <span className="sm:hidden">🖨️</span>
        </Button>
      ) : (
        <Button
          onClick={connectPrinter}
          variant="outline"
          size="sm"
          disabled={isConnecting}
          className="bg-card border-muted-foreground/30 hover:border-primary/50 shadow-lg gap-2"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="hidden sm:inline">Menghubungkan...</span>
            </>
          ) : (
            <>
              <BluetoothOff className="w-4 h-4 text-muted-foreground" />
              <span className="hidden sm:inline">Hubungkan Printer</span>
              <span className="sm:hidden">🖨️</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
