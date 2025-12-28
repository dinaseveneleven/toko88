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

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('[send-whatsapp-invoice] LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
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

    // Generate receipt text for AI prompt
    const items = transaction.items as any[];
    const timestamp = new Date(transaction.created_at);
    
    const itemsList = items.map(item => {
      const price = item.priceType === 'retail' ? item.product.retailPrice : item.product.bulkPrice;
      return `- ${item.product.name}: ${item.quantity} x ${formatRupiah(price)} = ${formatRupiah(price * item.quantity)}`;
    }).join('\n');

    const receiptPrompt = `Generate a clean, professional receipt image for a store called "TOKO 88". The receipt should look like a real printed thermal receipt with the following details:

HEADER:
- Store name: TOKO 88
- Address: Jl. Raya No. 88, Jakarta
- Phone: (021) 1234-5678

TRANSACTION DETAILS:
- Invoice No: ${transaction.id}
- Date: ${timestamp.toLocaleDateString('id-ID')}
- Time: ${timestamp.toLocaleTimeString('id-ID')}

ITEMS:
${itemsList}

TOTALS:
- Subtotal: ${formatRupiah(transaction.subtotal)}
${transaction.discount > 0 ? `- Discount: -${formatRupiah(transaction.discount)}` : ''}
- TOTAL: ${formatRupiah(transaction.total)}

PAYMENT:
- Method: ${transaction.payment_method.toUpperCase()}
${transaction.cash_received ? `- Cash: ${formatRupiah(transaction.cash_received)}` : ''}
${transaction.change ? `- Change: ${formatRupiah(transaction.change)}` : ''}

FOOTER:
- "Terima Kasih!" (Thank You!)

Style: White background, black text, clean typography, thermal receipt paper style with dotted/dashed line separators. Make it look like a real store receipt photo.`;

    console.log('[send-whatsapp-invoice] Generating receipt image...');

    // Generate receipt image using Lovable AI
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [
          {
            role: 'user',
            content: receiptPrompt
          }
        ],
        modalities: ['image', 'text']
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[send-whatsapp-invoice] AI image generation failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to generate receipt image', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('[send-whatsapp-invoice] AI response received');

    // Extract the image from the response
    const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!imageData) {
      console.error('[send-whatsapp-invoice] No image in AI response:', JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ error: 'Failed to generate receipt image - no image returned' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number for WhatsApp
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '62' + formattedPhone.slice(1);
    }

    console.log(`[send-whatsapp-invoice] Sending image to: ${formattedPhone}`);

    // Send image via Fonnte API
    const formData = new FormData();
    formData.append('target', formattedPhone);
    formData.append('message', `Struk pembelian Anda dari TOKO 88\nNo. Invoice: ${transaction.id}\nTerima kasih!`);
    formData.append('file', imageData); // Fonnte accepts base64 image in 'file' parameter

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
      JSON.stringify({ success: true, message: 'Invoice image sent via WhatsApp' }),
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
