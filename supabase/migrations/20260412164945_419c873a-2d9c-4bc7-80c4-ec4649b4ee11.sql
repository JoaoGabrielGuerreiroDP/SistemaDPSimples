
CREATE TABLE public.training_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  youtube_url text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_videos ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view
CREATE POLICY "Anyone can view training videos"
  ON public.training_videos FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update/delete
CREATE POLICY "Admins can insert training videos"
  ON public.training_videos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update training videos"
  ON public.training_videos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete training videos"
  ON public.training_videos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
