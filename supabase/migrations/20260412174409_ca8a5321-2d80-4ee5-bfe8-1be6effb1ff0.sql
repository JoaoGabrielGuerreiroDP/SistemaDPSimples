
ALTER TABLE public.training_videos
ADD COLUMN ai_summary TEXT,
ADD COLUMN ai_quiz JSONB,
ADD COLUMN ai_generated_at TIMESTAMP WITH TIME ZONE;
