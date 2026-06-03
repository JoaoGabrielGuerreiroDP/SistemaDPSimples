ALTER TABLE public.key_results 
ADD COLUMN status_changed_at timestamp with time zone NOT NULL DEFAULT now();