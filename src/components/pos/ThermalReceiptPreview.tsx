import { ReceiptData } from '@/types/pos';
import { buildInvoiceLines, buildWorkerCopyLines, renderPlainText } from '@/utils/receiptLayout';

interface ThermalReceiptPreviewProps {
  receipt: ReceiptData;
  storeInfo?: { address: string; phone: string };
  type: 'invoice' | 'worker';
}

export function ThermalReceiptPreview({ receipt, storeInfo, type }: ThermalReceiptPreviewProps) {
  const lines = type === 'invoice' 
    ? buildInvoiceLines(receipt, storeInfo)
    : buildWorkerCopyLines(receipt);
  
  const plainText = renderPlainText(lines);
  
  return (
    <div className="bg-white text-gray-900 p-4 rounded-lg max-w-xs mx-auto overflow-x-auto">
      <pre className="font-mono text-[10px] leading-tight whitespace-pre">
        {plainText}
      </pre>
    </div>
  );
}
