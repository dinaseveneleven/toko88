-- Insert new app_settings keys for store info and bank transfer
INSERT INTO public.app_settings (key, value) VALUES
  ('store_address', 'Jl. Raya No. 88, Jakarta'),
  ('store_phone', '(021) 1234-5678'),
  ('bank_name', NULL),
  ('bank_account_number', NULL),
  ('bank_account_holder', NULL),
  ('qris_image_url', NULL)
ON CONFLICT (key) DO NOTHING;

-- Create storage bucket for QRIS images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('qris', 'qris', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for QRIS bucket
-- Allow public read access
CREATE POLICY "QRIS images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'qris');

-- Allow admins to upload QRIS images
CREATE POLICY "Admins can upload QRIS images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'qris' AND has_role(auth.uid(), 'admin'));

-- Allow admins to update QRIS images
CREATE POLICY "Admins can update QRIS images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'qris' AND has_role(auth.uid(), 'admin'));

-- Allow admins to delete QRIS images
CREATE POLICY "Admins can delete QRIS images"
ON storage.objects FOR DELETE
USING (bucket_id = 'qris' AND has_role(auth.uid(), 'admin'));