CREATE TABLE public.training_path_contents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path_id UUID NOT NULL REFERENCES public.training_paths(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'video',
  title TEXT NOT NULL,
  url TEXT,
  file_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_path_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view path contents"
  ON public.training_path_contents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage path contents"
  ON public.training_path_contents FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestors can manage path contents"
  ON public.training_path_contents FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_training_path_contents_updated_at
  BEFORE UPDATE ON public.training_path_contents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for training uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('training-files', 'training-files', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view training files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'training-files');

CREATE POLICY "Admins can upload training files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'training-files' AND (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'gestor'::app_role)
  ));

CREATE POLICY "Admins can delete training files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'training-files' AND (
    public.has_role(auth.uid(), 'admin'::app_role) OR
    public.has_role(auth.uid(), 'gestor'::app_role)
  ));