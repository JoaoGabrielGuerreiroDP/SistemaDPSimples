ALTER TABLE public.key_results 
ADD COLUMN priority text NOT NULL DEFAULT 'medium' 
CHECK (priority IN ('high', 'medium', 'low'));