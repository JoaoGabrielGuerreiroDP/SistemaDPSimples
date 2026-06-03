ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS deadline date DEFAULT NULL;
ALTER TABLE public.key_results ADD COLUMN IF NOT EXISTS deadline date DEFAULT NULL;