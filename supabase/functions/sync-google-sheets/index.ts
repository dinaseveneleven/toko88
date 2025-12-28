import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
    .replace(/\\n/g, '') // Handle escaped newlines (literal \n)
    .replace(/\n/g, '')  // Handle actual newlines
    .replace(/\r/g, '')  // Handle carriage returns
    .replace(/\\/g, '')  // Remove trailing backslashes
    .replace(/\s/g, '') // Remove any whitespace
    .trim();
  
  console.log("PEM content length after cleanup:", pemContents.length);
  
  // Decode base64 to binary
  let binaryString: string;
  try {
    binaryString = atob(pemContents);
  } catch (e: unknown) {
    console.error("Base64 decode failed. First 50 chars:", pemContents.substring(0, 50));
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid private key format: ${message}`);
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
    console.error("Token exchange failed:", tokenData);
    throw new Error(`Failed to get access token: ${tokenData.error_description || tokenData.error}`);
  }

  return tokenData.access_token;
}

async function getSheetData(accessToken: string, sheetId: string, range: string): Promise<any[][]> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Failed to get sheet data:", error);
    throw new Error(`Failed to get sheet data: ${error}`);
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
    const error = await response.text();
    console.error("Failed to append sheet data:", error);
    throw new Error(`Failed to append data: ${error}`);
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
    const error = await response.text();
    console.error("Failed to update sheet data:", error);
    throw new Error(`Failed to update data: ${error}`);
  }
}

// Helper to parse Indonesian Rupiah format (e.g., "Rp18,000" or "Rp 18.000")
function parseRupiah(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  // Remove "Rp", "IDR", spaces, dots (thousand separator), and commas
  const cleaned = String(value)
    .replace(/Rp\.?/gi, '')
    .replace(/IDR/gi, '')
    .replace(/\s/g, '')
    .replace(/\./g, '') // Indonesian thousand separator
    .replace(/,/g, '')  // Alternative thousand separator
    .trim();
  
  return parseFloat(cleaned) || 0;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const email = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL");
    const privateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");
    let sheetId = Deno.env.get("GOOGLE_SHEET_ID");

    if (!email || !privateKey || !sheetId) {
      throw new Error("Missing Google Sheets configuration");
    }

    // Extract sheet ID if full URL was provided
    if (sheetId.includes("docs.google.com")) {
      const match = sheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match) {
        sheetId = match[1];
        console.log("Extracted sheet ID from URL:", sheetId);
      } else {
        throw new Error("Could not extract sheet ID from URL");
      }
    }

    // Parse the private key (handle escaped newlines)
    const formattedKey = privateKey.replace(/\\n/g, '\n');

    const { action, data } = await req.json();
    console.log(`Processing action: ${action}`);

    const accessToken = await getAccessToken(email, formattedKey);

    if (action === "getProducts") {
      // Get products from Products sheet (columns: ID, Name, RetailPrice, BulkPrice, PurchasePrice, Stock, Category)
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:G");
      
      const products = rows.map((row, index) => ({
        id: row[0] || String(index + 1),
        name: row[1] || "",
        retailPrice: parseRupiah(row[2]),
        bulkPrice: parseRupiah(row[3]),
        purchasePrice: parseRupiah(row[4]), // Harga Beli / Modal
        stock: parseInt(String(row[5]).replace(/[^\d]/g, '')) || 0,
        category: row[6] || "Lainnya",
      }));

      console.log(`Fetched ${products.length} products from sheet`);

      return new Response(JSON.stringify({ products }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "addTransaction") {
      // Add transaction to Transactions sheet
      const { receipt } = data;
      
      // Format items for the sheet
      const itemsSummary = receipt.items.map((item: any) => 
        `${item.product.name} x${item.quantity} (${item.priceType === 'retail' ? 'Eceran' : 'Grosir'})`
      ).join("; ");

      const row = [
        receipt.id,
        new Date(receipt.timestamp).toLocaleString("id-ID"),
        itemsSummary,
        receipt.subtotal,
        receipt.discount,
        receipt.total,
        receipt.paymentMethod,
        receipt.cashReceived || "",
        receipt.change || "",
        receipt.customerPhone || "",
      ];

      await appendSheetData(accessToken, sheetId, "Transactions!A:J", [row]);
      console.log(`Transaction ${receipt.id} added to sheet`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "updateStock") {
      // Update stock values in the Products sheet
      const { stockUpdates } = data;
      
      // stockUpdates is an array of { id: string, stock: number }
      // We need to get the current data first to find row numbers
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:G");
      
      // Build updated rows maintaining all original data but with new stock values
      const updatedRows = rows.map((row) => {
        const productId = row[0];
        const update = stockUpdates.find((u: { id: string; stock: number }) => u.id === productId);
        if (update) {
          // Update column F (index 5) with new stock value
          return [row[0], row[1], row[2], row[3], row[4], update.stock, row[6]];
        }
        return row;
      });

      // Write back the entire data range
      await updateSheetData(accessToken, sheetId, "Products!A2:G", updatedRows);
      console.log(`Updated stock for ${stockUpdates.length} products`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "updateInventory") {
      // Update inventory data (prices, stock) in the Products sheet
      const { inventoryUpdates } = data;
      
      // inventoryUpdates is an array of { id: string, retailPrice?: number, bulkPrice?: number, purchasePrice?: number, stock?: number }
      const rows = await getSheetData(accessToken, sheetId, "Products!A2:G");
      
      // Build updated rows maintaining all original data but with new values
      const updatedRows = rows.map((row) => {
        const productId = row[0];
        const update = inventoryUpdates.find((u: any) => u.id === productId);
        if (update) {
          return [
            row[0], // ID
            row[1], // Name
            update.retailPrice !== undefined ? update.retailPrice : row[2],
            update.bulkPrice !== undefined ? update.bulkPrice : row[3],
            update.purchasePrice !== undefined ? update.purchasePrice : row[4],
            update.stock !== undefined ? update.stock : row[5],
            row[6], // Category
          ];
        }
        return row;
      });

      // Write back the entire data range
      await updateSheetData(accessToken, sheetId, "Products!A2:G", updatedRows);
      console.log(`Updated inventory for ${inventoryUpdates.length} products`);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error) {
    console.error("Error in sync-google-sheets:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
