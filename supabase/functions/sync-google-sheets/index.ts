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
const VALID_ACTIONS = ['getProducts', 'addTransaction', 'updateStock', 'updateInventory', 'addProduct', 'deleteProduct', 'repairPriceFormat', 'updateVariantStock', 'addVariant', 'deleteVariant', 'updateVariantInventory'] as const;
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

async function getSheetNumericId(accessToken: string, sheetId: string, title: string): Promise<number> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets(properties(sheetId,title))`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    console.error("Failed to read spreadsheet metadata");
    throw new Error("Failed to read spreadsheet metadata");
  }

  const data = await response.json();
  const match = (data.sheets || []).find((s: any) => s?.properties?.title === title);
  const numericId = match?.properties?.sheetId;
  if (typeof numericId !== 'number') {
    throw new Error(`Sheet not found: ${title}`);
  }
  return numericId;
}

// Check if a sheet exists
async function sheetExists(accessToken: string, sheetId: string, title: string): Promise<boolean> {
  try {
    await getSheetNumericId(accessToken, sheetId, title);
    return true;
  } catch {
    return false;
  }
}

async function ensureProductsCurrencyFormat(accessToken: string, sheetId: string): Promise<void> {
  const numericSheetId = await getSheetNumericId(accessToken, sheetId, 'Products');

  // Columns: C (2) to E (4) => endColumnIndex is exclusive => 5
  const body = {
    requests: [
      {
        repeatCell: {
          range: {
            sheetId: numericSheetId,
            startRowIndex: 1, // from row 2 (0-based)
            startColumnIndex: 2,
            endColumnIndex: 5,
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'CURRENCY',
                pattern: '"Rp" #,##0',
              },
            },
          },
          fields: 'userEnteredFormat.numberFormat',
        },
      },
    ],
  };

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    // Formatting is best-effort; don't break core flows.
    console.warn('Failed to apply Products currency format');
  }
}

function normalizeProductsRow(row: any[]): any[] {
  return [
    row[0],
    row[1],
    parseRupiah(row[2]),
    parseRupiah(row[3]),
    parseRupiah(row[4]),
    row[5],
    row[6],
    row[7] ?? '', // VariantCode
    row[8] ?? '', // VariantName
    row[9] !== undefined && row[9] !== '' ? parseRupiah(row[9]) : '', // VariantRetailPrice
    row[10] !== undefined && row[10] !== '' ? parseRupiah(row[10]) : '', // VariantBulkPrice
  ];
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

// Normalize product IDs for matching between app and Sheets.
// Accepts formats like "P001", "p105", "105", "0007" and normalizes to digits ("1", "105", "7").
// If it doesn't look numeric, returns trimmed uppercase string.
function normalizeProductIdForMatch(id: string): string {
  const trimmed = String(id ?? '').trim();
  const match = trimmed.match(/^P?0*(\d+)$/i);
  if (match) return String(parseInt(match[1], 10));
  return trimmed.toUpperCase();
}

// Build products from Products sheet rows, grouping variants by product ID
// If a row has VariantCode (column H), it's a variant row
// Products are grouped by ID, with variants aggregated
function buildProductsFromRows(rows: any[][]): { id: string; name: string; retailPrice: number; bulkPrice: number; purchasePrice: number; stock: number; category: string; variants?: { code: string; name: string; stock: number; retailPrice?: number; bulkPrice?: number }[]; rowIndex: number }[] {
  const productMap = new Map<string, {
    id: string;
    name: string;
    retailPrice: number;
    bulkPrice: number;
    purchasePrice: number;
    stock: number;
    category: string;
    variants: { code: string; name: string; stock: number; retailPrice?: number; bulkPrice?: number; rowIndex: number }[];
    rowIndex: number;
  }>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const productId = String(row[0] ?? '').trim();
    const name = String(row[1] ?? '').trim();
    const retailPrice = parseRupiah(row[2]);
    const bulkPrice = parseRupiah(row[3]);
    const purchasePrice = parseRupiah(row[4]);
    const stock = parseInt(String(row[5]).replace(/[^\d]/g, '')) || 0;
    const category = String(row[6] ?? '').trim() || 'Lainnya';
    const variantCode = String(row[7] ?? '').trim();
    const variantName = String(row[8] ?? '').trim();
    const variantRetailPrice = row[9] !== undefined && row[9] !== '' ? parseRupiah(row[9]) : undefined;
    const variantBulkPrice = row[10] !== undefined && row[10] !== '' ? parseRupiah(row[10]) : undefined;

    if (!productId) continue;

    const normalizedId = normalizeProductIdForMatch(productId);

    // Variant row if either code OR name is present (code is optional)
    const isVariantRow = variantCode || variantName;
    
    if (isVariantRow) {
      // This is a variant row
      if (!productMap.has(normalizedId)) {
        productMap.set(normalizedId, {
          id: productId,
          name,
          retailPrice,
          bulkPrice,
          purchasePrice,
          stock: 0, // Will be calculated from variants
          category,
          variants: [],
          rowIndex: i,
        });
      }
      
      const product = productMap.get(normalizedId)!;
      product.variants.push({
        code: variantCode || variantName, // Use name as code fallback
        name: variantName || variantCode,
        stock,
        retailPrice: variantRetailPrice,
        bulkPrice: variantBulkPrice,
        rowIndex: i,
      });
    } else {
      // Regular product without variant
      if (!productMap.has(normalizedId)) {
        productMap.set(normalizedId, {
          id: productId,
          name,
          retailPrice,
          bulkPrice,
          purchasePrice,
          stock,
          category,
          variants: [],
          rowIndex: i,
        });
      } else {
        // Update stock for existing product (non-variant row)
        const product = productMap.get(normalizedId)!;
        product.stock = stock;
      }
    }
  }

  // Calculate total stock from variants if they exist
  const products: { id: string; name: string; retailPrice: number; bulkPrice: number; purchasePrice: number; stock: number; category: string; variants?: { code: string; name: string; stock: number; retailPrice?: number; bulkPrice?: number }[]; rowIndex: number }[] = [];
  
  for (const product of productMap.values()) {
    if (product.variants.length > 0) {
      product.stock = product.variants.reduce((sum, v) => sum + v.stock, 0);
      products.push({
        id: product.id,
        name: product.name,
        retailPrice: product.retailPrice,
        bulkPrice: product.bulkPrice,
        purchasePrice: product.purchasePrice,
        stock: product.stock,
        category: product.category,
        variants: product.variants.map(v => ({ 
          code: v.code, 
          name: v.name, 
          stock: v.stock,
          ...(v.retailPrice !== undefined ? { retailPrice: v.retailPrice } : {}),
          ...(v.bulkPrice !== undefined ? { bulkPrice: v.bulkPrice } : {}),
        })),
        rowIndex: product.rowIndex,
      });
    } else {
      products.push({
        id: product.id,
        name: product.name,
        retailPrice: product.retailPrice,
        bulkPrice: product.bulkPrice,
        purchasePrice: product.purchasePrice,
        stock: product.stock,
        category: product.category,
        rowIndex: product.rowIndex,
      });
    }
  }

  return products;
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
    const authRequiredActions = ['addTransaction', 'updateStock', 'updateInventory', 'addProduct', 'updateVariantStock', 'addVariant', 'deleteVariant', 'updateVariantInventory'];
    
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
      // Fetch bulk price percentage from app_settings
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: settingsData } = await supabaseClient
        .from('app_settings')
        .select('value')
        .eq('key', 'bulk_price_percentage')
        .maybeSingle();
      
      const bulkPricePercentage = settingsData?.value ? parseInt(settingsData.value, 10) : 98;
      const bulkPriceMultiplier = bulkPricePercentage / 100;
      
      console.log(`[${requestId}] Using bulk price percentage: ${bulkPricePercentage}%`);
      
      // Read Products sheet with variant columns (A-I)
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");
      
      // Build products with variants grouped
      const builtProducts = buildProductsFromRows(rows);
      
      // Track products that need bulk price update
      const productsToUpdate: { rowIndex: number; bulkPrice: number }[] = [];
      
      const products = builtProducts.map((product) => {
        let bulkPrice = product.bulkPrice;
        
        // Apply default bulk price formula if bulk price is 0
        if (bulkPrice === 0 && product.retailPrice > 0) {
          bulkPrice = Math.floor(product.retailPrice * bulkPriceMultiplier);
          productsToUpdate.push({ rowIndex: product.rowIndex, bulkPrice });
        }
        
        return {
          id: product.id,
          name: product.name,
          retailPrice: product.retailPrice,
          bulkPrice,
          purchasePrice: product.purchasePrice,
          stock: product.stock,
          category: product.category,
          ...(product.variants ? { variants: product.variants } : {}),
        };
      });

      // Update Google Sheet with calculated bulk prices (don't await - fire and forget)
      if (productsToUpdate.length > 0) {
        const updatesByRowIndex = new Map(productsToUpdate.map((u) => [u.rowIndex, u.bulkPrice] as const));

        const updatedRows = rows.map((row, index) => {
          const normalized = normalizeProductsRow(row);
          const maybeBulk = updatesByRowIndex.get(index);
          if (typeof maybeBulk === 'number') {
            // Replace bulk price (col D)
            normalized[3] = maybeBulk;
          }
          return normalized;
        });

        // Fire and forget - update in background, and re-apply currency format (best effort)
        updateSheetData(accessToken, sheetId, "Products!A2:K", updatedRows)
          .then(() => ensureProductsCurrencyFormat(accessToken, sheetId))
          .then(() => console.log(`Updated ${productsToUpdate.length} products with default bulk prices`))
          .catch((err: unknown) => console.error('Failed to update bulk prices:', err));
      } else {
        // Best-effort: keep column format consistent even when no values changed
        ensureProductsCurrencyFormat(accessToken, sheetId).catch(() => {});
      }

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

      // Format items for the sheet (sanitized) - include variant info
      const itemsSummary = receipt.items.map((item: any) => {
        const variantInfo = item.variantName ? ` [${item.variantName}]` : '';
        return `${sanitizeForSheets(item.product.name)}${variantInfo} x${item.quantity} (${item.priceType === 'retail' ? 'Eceran' : 'Grosir'})`;
      }).join("; ");

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

      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");

      const updatesByKey = new Map<string, { id: string; stock: number }>();
      for (const u of stockUpdates) {
        updatesByKey.set(normalizeProductIdForMatch(String(u.id)), { id: String(u.id), stock: u.stock });
      }

      const appliedKeys = new Set<string>();

      const updatedRows = rows.map((row) => {
        const rowId = String(row[0] ?? '').trim();
        const variantCode = String(row[7] ?? '').trim();
        
        // Skip variant rows - they should be updated via updateVariantStock
        if (variantCode) {
          return normalizeProductsRow(row);
        }
        
        const rowKey = normalizeProductIdForMatch(rowId);
        const update = updatesByKey.get(rowKey);
        const normalized = normalizeProductsRow(row);

        if (update) {
          normalized[5] = update.stock;
          appliedKeys.add(rowKey);
        }

        return normalized;
      });

      const notFoundIds = stockUpdates
        .filter((u) => !appliedKeys.has(normalizeProductIdForMatch(String(u.id))))
        .map((u) => String(u.id));

      if (notFoundIds.length > 0) {
        console.log(`[${requestId}] updateStock: IDs not found in sheet: ${notFoundIds.join(', ')}`);
        return new Response(
          JSON.stringify({
            error: 'Some products were not found in Google Sheets (ID mismatch)',
            notFoundIds,
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await updateSheetData(accessToken, sheetId, "Products!A2:K", updatedRows);
      await ensureProductsCurrencyFormat(accessToken, sheetId);

      console.log(`[${requestId}] Stock updated for ${stockUpdates.length} products`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // New action: Update variant stock (in Products sheet - column F is stock, column H is VariantCode)
    if (action === "updateVariantStock") {
      const { variantUpdates } = data || {};

      if (!variantUpdates || !Array.isArray(variantUpdates)) {
        return new Response(
          JSON.stringify({ error: 'Invalid variant stock update data' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate updates
      for (const update of variantUpdates) {
        validateString(update.productId, 'Product ID', 50);
        validateString(update.variantCode, 'Variant Code', 50);
        validateStock(update.stock);
      }

      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");

      // Create a map for quick lookup: "normalizedProductId|variantCode" -> update
      const updatesByKey = new Map<string, { productId: string; variantCode: string; stock: number }>();
      for (const u of variantUpdates) {
        const key = `${normalizeProductIdForMatch(String(u.productId))}|${String(u.variantCode).toUpperCase()}`;
        updatesByKey.set(key, { productId: String(u.productId), variantCode: String(u.variantCode), stock: u.stock });
      }

      const appliedKeys = new Set<string>();

      const updatedRows = rows.map((row) => {
        const productId = String(row[0] ?? '').trim();
        const variantCode = String(row[7] ?? '').trim(); // Column H is VariantCode
        
        if (!variantCode) {
          // Not a variant row, keep as-is
          return normalizeProductsRow(row);
        }
        
        const key = `${normalizeProductIdForMatch(productId)}|${variantCode.toUpperCase()}`;
        const update = updatesByKey.get(key);
        const normalized = normalizeProductsRow(row);

        if (update) {
          appliedKeys.add(key);
          normalized[5] = update.stock; // Update stock column (F)
        }

        return normalized;
      });

      const notFoundUpdates = variantUpdates.filter((u: { productId: string; variantCode: string }) => {
        const key = `${normalizeProductIdForMatch(String(u.productId))}|${String(u.variantCode).toUpperCase()}`;
        return !appliedKeys.has(key);
      });

      if (notFoundUpdates.length > 0) {
        console.log(`[${requestId}] updateVariantStock: Variants not found: ${JSON.stringify(notFoundUpdates)}`);
        return new Response(
          JSON.stringify({
            error: 'Some variants were not found in Google Sheets',
            notFoundVariants: notFoundUpdates.map((u: { productId: string; variantCode: string }) => ({ productId: u.productId, variantCode: u.variantCode })),
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await updateSheetData(accessToken, sheetId, "Products!A2:K", updatedRows);
      await ensureProductsCurrencyFormat(accessToken, sheetId);

      console.log(`[${requestId}] Variant stock updated for ${variantUpdates.length} variants`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Update variant inventory (price and stock)
    if (action === "updateVariantInventory") {
      const { variantUpdates } = data || {};

      if (!variantUpdates || !Array.isArray(variantUpdates)) {
        return new Response(
          JSON.stringify({ error: 'Invalid variant inventory update data' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate updates
      for (const update of variantUpdates) {
        validateString(update.productId, 'Product ID', 50);
        validateString(update.variantCode, 'Variant Code', 50);
        if (update.stock !== undefined) validateStock(update.stock);
        if (update.retailPrice !== undefined && update.retailPrice !== '') {
          validatePositiveNumber(update.retailPrice, 'Variant Retail Price');
        }
        if (update.bulkPrice !== undefined && update.bulkPrice !== '') {
          validatePositiveNumber(update.bulkPrice, 'Variant Bulk Price');
        }
      }

      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");

      // Create a map for quick lookup: "normalizedProductId|variantCode" -> update
      const updatesByKey = new Map<string, { productId: string; variantCode: string; stock?: number; retailPrice?: number | ''; bulkPrice?: number | '' }>();
      for (const u of variantUpdates) {
        const key = `${normalizeProductIdForMatch(String(u.productId))}|${String(u.variantCode).toUpperCase()}`;
        updatesByKey.set(key, { 
          productId: String(u.productId), 
          variantCode: String(u.variantCode), 
          stock: u.stock,
          retailPrice: u.retailPrice,
          bulkPrice: u.bulkPrice,
        });
      }

      const appliedKeys = new Set<string>();

      const updatedRows = rows.map((row) => {
        const productId = String(row[0] ?? '').trim();
        const variantCode = String(row[7] ?? '').trim(); // Column H is VariantCode
        
        if (!variantCode) {
          // Not a variant row, keep as-is
          return normalizeProductsRow(row);
        }
        
        const key = `${normalizeProductIdForMatch(productId)}|${variantCode.toUpperCase()}`;
        const update = updatesByKey.get(key);
        const normalized = normalizeProductsRow(row);

        if (update) {
          appliedKeys.add(key);
          // Update fields if provided
          if (update.stock !== undefined) {
            normalized[5] = update.stock; // Stock column (F)
          }
          if (update.retailPrice !== undefined) {
            normalized[9] = update.retailPrice === '' ? '' : update.retailPrice; // VariantRetailPrice (J)
          }
          if (update.bulkPrice !== undefined) {
            normalized[10] = update.bulkPrice === '' ? '' : update.bulkPrice; // VariantBulkPrice (K)
          }
        }

        return normalized;
      });

      const notFoundUpdates = variantUpdates.filter((u: { productId: string; variantCode: string }) => {
        const key = `${normalizeProductIdForMatch(String(u.productId))}|${String(u.variantCode).toUpperCase()}`;
        return !appliedKeys.has(key);
      });

      if (notFoundUpdates.length > 0) {
        console.log(`[${requestId}] updateVariantInventory: Variants not found: ${JSON.stringify(notFoundUpdates)}`);
        return new Response(
          JSON.stringify({
            error: 'Some variants were not found in Google Sheets',
            notFoundVariants: notFoundUpdates.map((u: { productId: string; variantCode: string }) => ({ productId: u.productId, variantCode: u.variantCode })),
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await updateSheetData(accessToken, sheetId, "Products!A2:K", updatedRows);
      await ensureProductsCurrencyFormat(accessToken, sheetId);

      console.log(`[${requestId}] Variant inventory updated for ${variantUpdates.length} variants`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "addVariant") {
      const { productId, variantCode, variantName, stock, retailPrice, bulkPrice } = data || {};

      if (!productId || typeof productId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid product ID' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validatedProductId = validateString(productId, 'Product ID', 50);
      const validatedVariantCode = validateString(variantCode, 'Variant Code', 50);
      const validatedVariantName = validateString(variantName || variantCode, 'Variant Name', 100);
      const validatedStock = validateStock(stock ?? 0);
      const validatedRetailPrice = retailPrice !== undefined && retailPrice !== '' ? validatePositiveNumber(retailPrice, 'Variant Retail Price') : '';
      const validatedBulkPrice = bulkPrice !== undefined && bulkPrice !== '' ? validatePositiveNumber(bulkPrice, 'Variant Bulk Price') : '';

      // Get existing products to find the product data
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");

      // Find the product (any row with matching ID)
      let productData: any[] | null = null;
      const normalizedRequestId = normalizeProductIdForMatch(validatedProductId);

      for (const row of rows) {
        const rowId = String(row[0] ?? '').trim();
        if (normalizeProductIdForMatch(rowId) === normalizedRequestId) {
          productData = row;
          break;
        }
      }

      if (!productData) {
        return new Response(
          JSON.stringify({ error: 'Product not found' }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if variant already exists
      for (const row of rows) {
        const rowId = String(row[0] ?? '').trim();
        const existingVariantCode = String(row[7] ?? '').trim();
        if (normalizeProductIdForMatch(rowId) === normalizedRequestId && 
            existingVariantCode.toUpperCase() === validatedVariantCode.toUpperCase()) {
          return new Response(
            JSON.stringify({ error: 'Variant with this code already exists' }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Create new variant row with same product info + variant-specific prices
      const newVariantRow = [
        productData[0], // ID
        productData[1], // Name
        parseRupiah(productData[2]), // RetailPrice (base product)
        parseRupiah(productData[3]), // BulkPrice (base product)
        parseRupiah(productData[4]), // PurchasePrice
        validatedStock, // Stock for this variant
        productData[6] || '', // Category
        sanitizeForSheets(validatedVariantCode), // VariantCode
        sanitizeForSheets(validatedVariantName), // VariantName
        validatedRetailPrice, // VariantRetailPrice (optional)
        validatedBulkPrice, // VariantBulkPrice (optional)
      ];

      await appendSheetData(accessToken, sheetId, "Products!A:K", [newVariantRow]);
      await ensureProductsCurrencyFormat(accessToken, sheetId);

      console.log(`[${requestId}] Variant ${validatedVariantCode} added to product ${validatedProductId}`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: Delete a variant from a product
    if (action === "deleteVariant") {
      const { productId, variantCode } = data || {};

      if (!productId || typeof productId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid product ID' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!variantCode || typeof variantCode !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid variant code' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const validatedProductId = validateString(productId, 'Product ID', 50);
      const validatedVariantCode = validateString(variantCode, 'Variant Code', 50);

      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");
      const normalizedRequestId = normalizeProductIdForMatch(validatedProductId);

      // Find the row index of the variant to delete
      let rowIndexToDelete = -1;
      for (let i = 0; i < rows.length; i++) {
        const rowId = String(rows[i][0] ?? '').trim();
        const existingVariantCode = String(rows[i][7] ?? '').trim();
        
        if (normalizeProductIdForMatch(rowId) === normalizedRequestId && 
            existingVariantCode.toUpperCase() === validatedVariantCode.toUpperCase()) {
          rowIndexToDelete = i;
          break;
        }
      }

      if (rowIndexToDelete === -1) {
        return new Response(
          JSON.stringify({ error: 'Variant not found' }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get the numeric sheet ID
      const numericSheetId = await getSheetNumericId(accessToken, sheetId, 'Products');

      // Delete the row (row index + 1 for header row, 0-based for API)
      const sheetRowIndex = rowIndexToDelete + 1;
      
      const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
      const deleteResponse = await fetch(deleteUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId: numericSheetId,
                dimension: "ROWS",
                startIndex: sheetRowIndex,
                endIndex: sheetRowIndex + 1
              }
            }
          }]
        }),
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.text();
        console.error(`[${requestId}] Failed to delete variant row:`, errorData);
        throw new Error("Failed to delete variant");
      }

      console.log(`[${requestId}] Variant ${validatedVariantCode} deleted from product ${validatedProductId}`);

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

      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");

      const updatesByKey = new Map<string, any>();
      for (const u of inventoryUpdates) {
        updatesByKey.set(normalizeProductIdForMatch(String(u.id)), u);
      }

      const appliedKeys = new Set<string>();

      const updatedRows = rows.map((row) => {
        const rowId = String(row[0] ?? '').trim();
        const rowKey = normalizeProductIdForMatch(rowId);
        const update = updatesByKey.get(rowKey);
        const normalized = normalizeProductsRow(row);

        if (update) {
          appliedKeys.add(rowKey);
          // Use explicit checks for 0 values - they should be saved, not treated as falsy
          const newRetailPrice = typeof update.retailPrice === 'number' ? update.retailPrice : normalized[2];
          const newBulkPrice = typeof update.bulkPrice === 'number' ? update.bulkPrice : normalized[3];
          const newPurchasePrice = typeof update.purchasePrice === 'number' ? update.purchasePrice : normalized[4];
          const newStock = typeof update.stock === 'number' ? update.stock : normalized[5];

          normalized[2] = newRetailPrice;
          normalized[3] = newBulkPrice;
          normalized[4] = newPurchasePrice;
          normalized[5] = newStock;
        }

        return normalized;
      });

      const notFoundIds = inventoryUpdates
        .filter((u) => !appliedKeys.has(normalizeProductIdForMatch(String(u.id))))
        .map((u) => String(u.id));

      if (notFoundIds.length > 0) {
        console.log(`[${requestId}] updateInventory: IDs not found in sheet: ${notFoundIds.join(', ')}`);
        return new Response(
          JSON.stringify({
            error: 'Some products were not found in Google Sheets (ID mismatch)',
            notFoundIds,
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await updateSheetData(accessToken, sheetId, "Products!A2:K", updatedRows);
      await ensureProductsCurrencyFormat(accessToken, sheetId);

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
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");
      
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

      // Append new product row: [id, name, retailPrice, bulkPrice, purchasePrice, stock, category, variantCode, variantName, variantRetailPrice, variantBulkPrice]
      const newRow = [
        newId,
        sanitizeForSheets(name),
        retailPrice,
        bulkPrice,
        purchasePrice,
        stock,
        sanitizeForSheets(category),
        '', // VariantCode (empty for non-variant products)
        '', // VariantName (empty for non-variant products)
        '', // VariantRetailPrice (empty for non-variant products)
        '', // VariantBulkPrice (empty for non-variant products)
      ];

      await appendSheetData(accessToken, sheetId, "Products!A:K", [newRow]);
      await ensureProductsCurrencyFormat(accessToken, sheetId);

      console.log(`[${requestId}] Product ${newId} added successfully`);

      return new Response(JSON.stringify({ success: true, productId: newId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "deleteProduct") {
      const { productId } = data || {};
      
      if (!productId || typeof productId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Invalid product ID' }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get existing products
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");
      
      // Find the row index of the product to delete
      let rowIndexToDelete = -1;
      const trimmedProductId = String(productId).trim();
      
      for (let i = 0; i < rows.length; i++) {
        const rowId = String(rows[i][0] ?? '').trim();
        if (rowId === trimmedProductId) {
          rowIndexToDelete = i;
          break;
        }
      }

      if (rowIndexToDelete === -1) {
        return new Response(
          JSON.stringify({ error: 'Product not found' }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete the row using batchUpdate (row index + 2 because of header row and 0-based index)
      const sheetRowIndex = rowIndexToDelete + 1; // +1 for header row (0-based for API)
      
      // First, get the sheet ID (numeric) from the spreadsheet
      const spreadsheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
      const spreadsheetResponse = await fetch(spreadsheetUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      
      if (!spreadsheetResponse.ok) {
        throw new Error("Failed to get spreadsheet info");
      }
      
      const spreadsheetData = await spreadsheetResponse.json();
      const productsSheet = spreadsheetData.sheets?.find((s: any) => 
        s.properties?.title === 'Products'
      );
      
      if (!productsSheet) {
        throw new Error("Products sheet not found");
      }
      
      const numericSheetId = productsSheet.properties.sheetId;
      
      // Delete the row using batchUpdate
      const deleteUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`;
      const deleteResponse = await fetch(deleteUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [{
            deleteDimension: {
              range: {
                sheetId: numericSheetId,
                dimension: "ROWS",
                startIndex: sheetRowIndex, // 0-based, after header
                endIndex: sheetRowIndex + 1
              }
            }
          }]
        }),
      });

      if (!deleteResponse.ok) {
        const errorData = await deleteResponse.text();
        console.error(`[${requestId}] Failed to delete row:`, errorData);
        throw new Error("Failed to delete product");
      }

      console.log(`[${requestId}] Product ${productId} deleted successfully`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "repairPriceFormat") {
      // Get all products and normalize price values to numbers, then apply currency format
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:K");
      
      if (rows.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'No products to repair' }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Normalize all rows - convert text prices to numbers
      const normalizedRows = rows.map((row) => normalizeProductsRow(row));

      // Write back normalized data
      await updateSheetData(accessToken, sheetId, "Products!A2:K", normalizedRows);

      // Apply currency format
      await ensureProductsCurrencyFormat(accessToken, sheetId);

      console.log(`[${requestId}] Repaired price format for ${rows.length} products`);

      return new Response(JSON.stringify({ success: true, repaired: rows.length }), {
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
