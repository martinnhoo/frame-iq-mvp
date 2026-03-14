-- Create storage bucket for ad creatives (videos uploaded for analysis)
INSERT INTO storage.buckets (id, name, public) VALUES ('ad-creatives', 'ad-creatives', false);

-- RLS: Users can upload their own ad creatives
CREATE POLICY "Users upload own ad creatives" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ad-creatives' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can view their own ad creatives
CREATE POLICY "Users view own ad creatives" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'ad-creatives' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: Users can delete their own ad creatives
CREATE POLICY "Users delete own ad creatives" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'ad-creatives' AND (storage.foldername(name))[1] = auth.uid()::text);