
-- 1. Trilhas de aprendizado
CREATE TABLE public.training_paths (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view training paths" ON public.training_paths FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage training paths" ON public.training_paths FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestors can manage training paths" ON public.training_paths FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role)) WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_training_paths_updated_at BEFORE UPDATE ON public.training_paths
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Vínculo trilha ↔ vídeo
CREATE TABLE public.training_path_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path_id UUID NOT NULL REFERENCES public.training_paths(id) ON DELETE CASCADE,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(path_id, video_id)
);
ALTER TABLE public.training_path_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view path videos" ON public.training_path_videos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage path videos" ON public.training_path_videos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestors can manage path videos" ON public.training_path_videos FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role)) WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

-- 3. Status de vídeo assistido
CREATE TABLE public.training_watch_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, video_id)
);
ALTER TABLE public.training_watch_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own watch status" ON public.training_watch_status FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own watch status" ON public.training_watch_status FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own watch status" ON public.training_watch_status FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all watch status" ON public.training_watch_status FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- 4. Comentários por vídeo
CREATE TABLE public.training_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON public.training_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own comments" ON public.training_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own comments" ON public.training_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.training_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any comment" ON public.training_comments FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_training_comments_updated_at BEFORE UPDATE ON public.training_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Avaliações por estrelas
CREATE TABLE public.training_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(video_id, user_id)
);
ALTER TABLE public.training_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings" ON public.training_ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own rating" ON public.training_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own rating" ON public.training_ratings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 6. Anotações pessoais
CREATE TABLE public.training_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(video_id, user_id)
);
ALTER TABLE public.training_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notes" ON public.training_notes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own notes" ON public.training_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own notes" ON public.training_notes FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notes" ON public.training_notes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_training_notes_updated_at BEFORE UPDATE ON public.training_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Materiais de apoio (anexos)
CREATE TABLE public.training_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'link',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.training_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view attachments" ON public.training_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage attachments" ON public.training_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Gestors can manage attachments" ON public.training_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role)) WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));
