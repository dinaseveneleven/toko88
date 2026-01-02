import { ReceiptData } from '@/types/pos';
import { buildInvoiceLines, buildWorkerCopyLines, renderPlainText } from '@/utils/receiptLayout';

interface ThermalReceiptPreviewProps {
  receipt: ReceiptData;
  storeInfo?: { name?: string; address: string; phone: string };
  type: 'invoice' | 'worker';
}

export function ThermalReceiptPreview({ receipt, storeInfo, type }: ThermalReceiptPreviewProps) {
  const lines = type === 'invoice' 
    ? buildInvoiceLines(receipt, storeInfo)
    : buildWorkerCopyLines(receipt);
  
  const plainText = renderPlainText(lines);
  
  return (
    <div className="bg-white text-gray-900 rounded-lg max-w-sm mx-auto shadow-lg border border-gray-200 overflow-hidden">
      {/* Paper texture effect */}
      <div className="bg-gradient-to-b from-gray-50 to-white p-4 flex justify-center">
        <pre 
          className="font-mono text-[11px] leading-relaxed whitespace-pre"
          style={{ fontFamily: "'Courier New', Courier, monospace" }}
        >
          {plainText}
        </pre>
      </div>
      {/* Torn paper edge effect */}
      <div className="h-2 bg-gradient-to-b from-gray-100 to-transparent" 
           style={{ 
             maskImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 100 10\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0 Q 5 10 10 0 T 20 0 T 30 0 T 40 0 T 50 0 T 60 0 T 70 0 T 80 0 T 90 0 T 100 0 V 10 H 0 Z\' fill=\'black\'/%3E%3C/svg%3E")',
             WebkitMaskImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 100 10\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0 Q 5 10 10 0 T 20 0 T 30 0 T 40 0 T 50 0 T 60 0 T 70 0 T 80 0 T 90 0 T 100 0 V 10 H 0 Z\' fill=\'black\'/%3E%3C/svg%3E")',
             maskSize: '100% 100%',
             WebkitMaskSize: '100% 100%'
           }} 
      />
    </div>
  );
}
