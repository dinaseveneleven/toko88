-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create printer_configs table for per-user printer settings
CREATE TABLE public.printer_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  printer_name text,
  printer_device_id text,
  is_enabled boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.printer_configs ENABLE ROW LEVEL SECURITY;

-- Users can view their own printer config
CREATE POLICY "Users can view their own printer config"
ON public.printer_configs
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own printer config
CREATE POLICY "Users can insert their own printer config"
ON public.printer_configs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own printer config
CREATE POLICY "Users can update their own printer config"
ON public.printer_configs
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own printer config
CREATE POLICY "Users can delete their own printer config"
ON public.printer_configs
FOR DELETE
USING (auth.uid() = user_id);

-- Admins can view all printer configs
CREATE POLICY "Admins can view all printer configs"
ON public.printer_configs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update all printer configs
CREATE POLICY "Admins can update all printer configs"
ON public.printer_configs
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert printer configs for any user
CREATE POLICY "Admins can insert printer configs"
ON public.printer_configs
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete printer configs
CREATE POLICY "Admins can delete printer configs"
ON public.printer_configs
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_printer_configs_updated_at
BEFORE UPDATE ON public.printer_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();