
CREATE TABLE public.training_quiz_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id UUID NOT NULL REFERENCES public.training_videos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  total_questions INTEGER NOT NULL DEFAULT 10,
  answers JSONB NOT NULL DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(video_id, user_id)
);

ALTER TABLE public.training_quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own results"
ON public.training_quiz_results FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins and gestors can view all results"
ON public.training_quiz_results FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Users can insert their own results"
ON public.training_quiz_results FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own results"
ON public.training_quiz_results FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_training_quiz_results_updated_at
BEFORE UPDATE ON public.training_quiz_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
