-- Create app_settings table for storing configuration like public invoice URL
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings (needed for QR generation)
CREATE POLICY "Anyone can read app settings"
ON public.app_settings
FOR SELECT
USING (true);

-- Only admins can insert/update settings
CREATE POLICY "Admins can insert app settings"
ON public.app_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update app settings"
ON public.app_settings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default public_invoice_base_url setting
INSERT INTO public.app_settings (key, value) VALUES ('public_invoice_base_url', NULL);