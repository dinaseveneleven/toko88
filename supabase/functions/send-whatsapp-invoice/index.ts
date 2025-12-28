import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(num);
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId, phone } = await req.json();

    console.log(`[send-whatsapp-invoice] Sending invoice ${invoiceId} to ${phone}`);

    if (!invoiceId || !phone) {
      return new Response(
        JSON.stringify({ error: 'Invoice ID and phone number are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const FONNTE_API_TOKEN = Deno.env.get('FONNTE_API_TOKEN');
    if (!FONNTE_API_TOKEN) {
      console.error('[send-whatsapp-invoice] FONNTE_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'WhatsApp service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch transaction data
    const { data: transaction, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (fetchError || !transaction) {
      console.error('[send-whatsapp-invoice] Transaction not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate receipt text
    const items = transaction.items as any[];
    const timestamp = new Date(transaction.created_at);
    
    const receiptLines = [
      '================================',
      '         TOKO 88',
      '    Jl. Raya No. 88, Jakarta',
      '      Tel: (021) 1234-5678',
      '================================',
      '',
      `No: ${transaction.id}`,
      `Tanggal: ${timestamp.toLocaleDateString('id-ID')}`,
      `Waktu: ${timestamp.toLocaleTimeString('id-ID')}`,
      '',
      '--------------------------------',
      ...items.map(item => {
        const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
        return `${item.product.name}\n  ${item.quantity} x ${formatRupiah(price)} = ${formatRupiah(price * item.quantity)}`;
      }),
      '--------------------------------',
      `Subtotal: ${formatRupiah(transaction.subtotal)}`,
      ...(transaction.discount > 0 ? [`Diskon: -${formatRupiah(transaction.discount)}`] : []),
      `TOTAL: ${formatRupiah(transaction.total)}`,
      '',
      `Pembayaran: ${transaction.payment_method}`,
      ...(transaction.cash_received ? [
        `Tunai: ${formatRupiah(transaction.cash_received)}`,
        `Kembalian: ${formatRupiah(transaction.change || 0)}`
      ] : []),
      '',
      '================================',
      '      Terima Kasih!',
      '================================',
    ];

    const receiptText = receiptLines.join('\n');

    // Format phone number for WhatsApp
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }

    console.log(`[send-whatsapp-invoice] Sending to formatted phone: ${formattedPhone}`);

    // Send via Fonnte API
    const formData = new FormData();
    formData.append('target', formattedPhone);
    formData.append('message', receiptText);

    const fonntResponse = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_API_TOKEN,
      },
      body: formData,
    });

    const fonntResult = await fonntResponse.json();
    console.log('[send-whatsapp-invoice] Fonnte response:', fonntResult);

    if (!fonntResult.status) {
      return new Response(
        JSON.stringify({ error: 'Failed to send WhatsApp message', details: fonntResult }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Invoice sent via WhatsApp' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[send-whatsapp-invoice] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
