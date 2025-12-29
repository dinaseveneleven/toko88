-- Remove the insecure public read policy
DROP POLICY IF EXISTS "Anyone can view transactions" ON public.transactions;

-- Add role-based read policy for admin and cashier only
CREATE POLICY "Staff can view transactions" 
ON public.transactions 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'cashier')
);

-- Update the insert policy to also be role-based
DROP POLICY IF EXISTS "Authenticated users can insert transactions" ON public.transactions;

CREATE POLICY "Staff can insert transactions" 
ON public.transactions 
FOR INSERT 
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'cashier')
);