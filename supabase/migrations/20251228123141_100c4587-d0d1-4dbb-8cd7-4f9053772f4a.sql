-- Create transactions table for storing receipt data
CREATE TABLE public.transactions (
  id TEXT PRIMARY KEY,
  items JSONB NOT NULL,
  subtotal NUMERIC NOT NULL,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  cash_received NUMERIC,
  change NUMERIC,
  customer_phone TEXT,
  customer_name TEXT,
  cashier TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Allow public read access (so anyone with invoice link can view)
CREATE POLICY "Anyone can view transactions"
ON public.transactions
FOR SELECT
USING (true);

-- Only authenticated users can insert transactions
CREATE POLICY "Authenticated users can insert transactions"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK (true);