import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // max requests per window per user
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);
  
  if (!userLimit || now - userLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
    // New window
    rateLimitStore.set(userId, { count: 1, windowStart: now });
    return true;
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, limit] of rateLimitStore.entries()) {
    if (now - limit.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(userId);
    }
  }
}, RATE_LIMIT_WINDOW_MS);

// Input validation schemas
const VALID_ACTIONS = ['getProducts', 'addTransaction', 'updateStock', 'updateInventory', 'addProduct'] as const;
type ValidAction = typeof VALID_ACTIONS[number];

function isValidAction(action: string): action is ValidAction {
  return VALID_ACTIONS.includes(action as ValidAction);
}

function sanitizeForSheets(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Prefix formulas with single quote to render as text (prevents formula injection)
  if (str.match(/^[=+@-]/)) {
    return "'" + str;
  }
  return str;
}

function validatePositiveNumber(value: unknown, fieldName: string, max: number = 100000000): number {
  if (typeof value !== 'number' || isNaN(value)) {
    throw new Error(`${fieldName} must be a valid number`);
  }
  if (value < 0) {
    throw new Error(`${fieldName} cannot be negative`);
  }
  if (value > max) {
    throw new Error(`${fieldName} exceeds maximum allowed value`);
  }
  return value;
}

function validateStock(value: unknown): number {
  if (typeof value !== 'number' || isNaN(value) || !Number.isInteger(value)) {
    throw new Error('Stock must be a valid integer');
  }
  if (value < 0) {
    throw new Error('Stock cannot be negative');
  }
  if (value > 100000) {
    throw new Error('Stock exceeds maximum allowed value');
  }
  return value;
}

function validateString(value: unknown, fieldName: string, maxLength: number = 200): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  if (value.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength}`);
  }
  return value;
}

function validatePhoneNumber(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value !== 'string') {
    throw new Error('Phone number must be a string');
  }
  if (value.length > 20) {
    throw new Error('Phone number is too long');
  }
  if (!value.match(/^[0-9+().\-\s]*$/)) {
    throw new Error('Phone number contains invalid characters');
  }
  return value;
}

// Google Sheets API helper
async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const claimB64 = btoa(JSON.stringify(claim)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${headerB64}.${claimB64}`;

  // Import private key and sign - handle various formats
  let pemContents = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '')
    .replace(/\\/g, '')
    .replace(/\s/g, '')
    .trim();
  
  // Decode base64 to binary
  let binaryString: string;
  try {
    binaryString = atob(pemContents);
  } catch (e: unknown) {
    throw new Error("Invalid private key format");
  }
  
  const binaryDer = Uint8Array.from(binaryString, c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok) {
    console.error("Token exchange failed");
    throw new Error("Failed to authenticate with Google");
  }

  return tokenData.access_token;
}

async function getSheetData(accessToken: string, sheetId: string, range: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("Failed to get sheet data");
    throw new Error("Failed to retrieve data");
  }

  const data = await response.json();
  return data.values || [];
}

async function appendSheetData(accessToken: string, sheetId: string, range: string, values: any[][]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    console.error("Failed to append sheet data");
    throw new Error("Failed to save data");
  }
}

async function updateSheetData(accessToken: string, sheetId: string, range: string, values: any[][]): Promise<void> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });

  if (!response.ok) {
    console.error("Failed to update sheet data");
    throw new Error("Failed to update data");
  }
}

// Helper to parse Indonesian Rupiah format
function parseRupiah(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }
  if (!value) {
    return 0;
  }
  
  const original = String(value);
  
  let cleaned = original
    .replace(/Rp\.?/gi, '')
    .replace(/IDR/gi, '')
    .replace(/\s/g, '')
    .trim();
  
  const hasDecimalComma = /\d,\d{1,2}$/.test(cleaned);
  const hasDecimalDot = /\d\.\d{1,2}$/.test(cleaned);
  
  if (hasDecimalComma) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasDecimalDot) {
    cleaned = cleaned.replace(/,/g, '');
  } else {
    cleaned = cleaned.replace(/[.,]/g, '');
  }
  
  return parseFloat(cleaned) || 0;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Generate request ID for audit trail
    const requestId = crypto.randomUUID();
    
    // Parse request body first to check action
    const { action, data } = await req.json();
    
    // Validate action
    if (!action || !isValidAction(action)) {
      console.log(`[${requestId}] Invalid action attempted: ${action}`);
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Actions that require authentication
    const authRequiredActions = ['addTransaction', 'updateStock', 'updateInventory', 'addProduct'];
    
    let user = null;
    
    // Check authentication for protected actions
    if (authRequiredActions.includes(action)) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser();
      if (authError || !authUser) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      user = authUser;

      // Apply rate limiting for authenticated users
      if (!checkRateLimit(user.id)) {
        console.log(`[${requestId}] Rate limit exceeded for user ${user.id}`);
        return new Response(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log(`[${requestId}] Processing action: ${action}${user ? ` by user ${user.id}` : ''}`);

    const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
    let sheetId = Deno.env.get("GOOGLE_SHEET_ID");

    if (!email || !privateKey || !sheetId) {
      throw new Error("Server configuration error");
    }

    // Extract sheet ID if full URL was provided
    if (sheetId.includes("docs.google.com")) {
      const match = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        sheetId = match[1];
      } else {
        throw new Error("Invalid sheet configuration");
      }
    }

    // Parse the private key
    const formattedKey = privateKey.replace(/\\n/g, '\n');

    const accessToken = await getAccessToken(email, formattedKey);

    if (action === "getProducts") {
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:G");
      
      const products = rows.map((row, index) => ({
        id: sanitizeForSheets(row[0]) || String(index + 1),
        name: sanitizeForSheets(row[1]) || "",
        retailPrice: parseRupiah(row[2]),
        bulkPrice: parseRupiah(row[3]),
        purchasePrice: parseRupiah(row[4]),
        stock: parseInt(String(row[5]).replace(/[^\d]/g, '')) || 0,
        category: sanitizeForSheets(row[6]) || "Lainnya",
      }));

      return new Response(JSON.stringify({ products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "addTransaction") {
      const { receipt } = data || {};
      
      if (!receipt || !receipt.id || !receipt.items || !Array.isArray(receipt.items)) {
        return new Response(
          JSON.stringify({ error: 'Invalid transaction data' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate receipt data
      validateString(receipt.id, 'Receipt ID', 100);
      validatePositiveNumber(receipt.subtotal, 'Subtotal');
      validatePositiveNumber(receipt.total, 'Total');
      if (receipt.discount !== undefined) {
        validatePositiveNumber(receipt.discount, 'Discount');
      }
      
      const validPaymentMethods = ['cash', 'transfer', 'qris'];
      const paymentMethod = String(receipt.paymentMethod || '').toLowerCase();
      if (!validPaymentMethods.includes(paymentMethod)) {
        return new Response(
          JSON.stringify({ error: 'Invalid payment method' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const customerPhone = validatePhoneNumber(receipt.customerPhone);

      // Validate items
      for (const item of receipt.items) {
        if (!item.product?.name) {
          return new Response(
            JSON.stringify({ error: 'Invalid item data' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        validateString(item.product.name, 'Product name');
        validatePositiveNumber(item.quantity, 'Quantity', 10000);
        if (!['retail', 'bulk'].includes(item.priceType)) {
          return new Response(
            JSON.stringify({ error: 'Invalid price type' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Format items for the sheet (sanitized)
      const itemsSummary = receipt.items.map((item: any) => 
        `${sanitizeForSheets(item.product.name)} x${item.quantity} (${item.priceType === 'retail' ? 'Eceran' : 'Grosir'})`
      ).join("; ");

      const row = [
        sanitizeForSheets(receipt.id),
        new Date(receipt.timestamp).toLocaleString("id-ID"),
        sanitizeForSheets(itemsSummary),
        receipt.subtotal,
        receipt.discount || 0,
        receipt.total,
        receipt.paymentMethod,
        receipt.cashReceived || "",
        receipt.change || "",
        sanitizeForSheets(customerPhone),
      ];

      await appendSheetData(accessToken, sheetId, "Transactions!A:J", [row]);

      console.log(`[${requestId}] Transaction ${receipt.id} added successfully`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "updateStock") {
      const { stockUpdates } = data || {};
      
      if (!stockUpdates || !Array.isArray(stockUpdates)) {
        return new Response(
          JSON.stringify({ error: 'Invalid stock update data' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate stock updates
      for (const update of stockUpdates) {
        validateString(update.id, 'Product ID', 50);
        validateStock(update.stock);
      }

      const rows = await getSheetData(accessToken, sheetId, "Products!A2:G");
      
      const updatedRows = rows.map((row) => {
        const productId = row[0];
        const update = stockUpdates.find((u: { id: string; stock: number }) => u.id === productId);
        if (update) {
          return [row[0], row[1], row[2], row[3], row[4], update.stock, row[6]];
        }
        return row;
      });

      await updateSheetData(accessToken, sheetId, "Products!A2:G", updatedRows);

      console.log(`[${requestId}] Stock updated for ${stockUpdates.length} products`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "updateInventory") {
      const { inventoryUpdates } = data || {};
      
      if (!inventoryUpdates || !Array.isArray(inventoryUpdates)) {
        return new Response(
          JSON.stringify({ error: 'Invalid inventory update data' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate inventory updates
      for (const update of inventoryUpdates) {
        validateString(update.id, 'Product ID', 50);
        if (update.retailPrice !== undefined) {
          validatePositiveNumber(update.retailPrice, 'Retail price');
        }
        if (update.bulkPrice !== undefined) {
          validatePositiveNumber(update.bulkPrice, 'Bulk price');
        }
        if (update.purchasePrice !== undefined) {
          validatePositiveNumber(update.purchasePrice, 'Purchase price');
        }
        if (update.stock !== undefined) {
          validateStock(update.stock);
        }
      }

      const rows = await getSheetData(accessToken, sheetId, "Products!A2:G");
      
      const updatedRows = rows.map((row) => {
        const productId = row[0];
        const update = inventoryUpdates.find((u: any) => u.id === productId);
        if (update) {
          // Use explicit checks for 0 values - they should be saved, not treated as falsy
          const newRetailPrice = typeof update.retailPrice === 'number' ? update.retailPrice : row[2];
          const newBulkPrice = typeof update.bulkPrice === 'number' ? update.bulkPrice : row[3];
          const newPurchasePrice = typeof update.purchasePrice === 'number' ? update.purchasePrice : row[4];
          const newStock = typeof update.stock === 'number' ? update.stock : row[5];
          
          return [
            row[0],
            row[1],
            newRetailPrice,
            newBulkPrice,
            newPurchasePrice,
            newStock,
            row[6],
          ];
        }
        return row;
      });

      await updateSheetData(accessToken, sheetId, "Products!A2:G", updatedRows);

      console.log(`[${requestId}] Inventory updated for ${inventoryUpdates.length} products`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "addProduct") {
      const { product } = data || {};
      
      if (!product) {
        return new Response(
          JSON.stringify({ error: 'Invalid product data' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate product fields
      const name = validateString(product.name, 'Product name', 200);
      const category = validateString(product.category, 'Category', 100);
      const purchasePrice = validatePositiveNumber(product.purchasePrice, 'Purchase price');
      const retailPrice = validatePositiveNumber(product.retailPrice, 'Retail price');
      const bulkPrice = validatePositiveNumber(product.bulkPrice, 'Bulk price');
      const stock = validateStock(product.stock);

      // Get existing products to generate a unique ID
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:G");
      
      // Generate unique ID (format: P001, P002, etc.)
      let maxId = 0;
      for (const row of rows) {
        const idStr = String(row[0] || '');
        const match = idStr.match(/^P?(\d+)$/i);
        if (match) {
          const num = parseInt(match[1]);
          if (num > maxId) maxId = num;
        }
      }
      const newId = `P${String(maxId + 1).padStart(3, '0')}`;

      // Append new product row: [id, name, retailPrice, bulkPrice, purchasePrice, stock, category]
      const newRow = [
        newId,
        sanitizeForSheets(name),
        retailPrice,
        bulkPrice,
        purchasePrice,
        stock,
        sanitizeForSheets(category),
      ];

      await appendSheetData(accessToken, sheetId, "Products!A:G", [newRow]);

      console.log(`[${requestId}] Product ${newId} added successfully`);

      return new Response(JSON.stringify({ success: true, productId: newId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[${requestId}] Invalid action: ${action}`);
    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in sync-google-sheets:", error);
    // Return generic error message to client
    return new Response(
      JSON.stringify({ error: 'An error occurred processing your request' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});