ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.objectives ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.key_results ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone DEFAULT NULL;