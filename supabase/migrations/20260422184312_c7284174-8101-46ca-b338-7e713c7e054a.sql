
-- Create bucket for playbook contributions
INSERT INTO storage.buckets (id, name, public)
VALUES ('playbook-contributions', 'playbook-contributions', true)
ON CONFLICT (id) DO NOTHING;

-- Table for contributions metadata
CREATE TABLE public.playbook_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.playbook_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contributions"
ON public.playbook_contributions FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Users can insert own contributions"
ON public.playbook_contributions FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own / admins delete any"
ON public.playbook_contributions FOR DELETE
TO authenticated USING (
  auth.uid() = user_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

-- Storage policies
CREATE POLICY "Authenticated can view playbook files"
ON storage.objects FOR SELECT
TO authenticated USING (bucket_id = 'playbook-contributions');

CREATE POLICY "Authenticated can upload playbook files"
ON storage.objects FOR INSERT
TO authenticated WITH CHECK (
  bucket_id = 'playbook-contributions'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own playbook files / admins any"
ON storage.objects FOR DELETE
TO authenticated USING (
  bucket_id = 'playbook-contributions'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
  )
);
